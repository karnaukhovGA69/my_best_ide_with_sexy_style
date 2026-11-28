/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import type { IDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isWindows } from '../../../../base/common/platform.js';
import { dirname } from '../../../../base/common/resources.js';
import { hasKey } from '../../../../base/common/types.js';
import type { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { FileType, hasOpenReadWriteCloseCapability, IFileService } from '../../../../platform/files/common/files.js';
import type { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { VIEWLET_ID } from '../../extensions/common/extensions.js';
import { localVsixSetMaxBytes, localVsixSetMaxEntries, parseLocalVsixSet, type ILocalVsixSet, type LocalVsixSetIssue } from '../common/localVsixSet.js';
import { checkLocalVsixSetChecksums, localVsixArchiveMaxMiB, localVsixSetReadMaxMiB } from './localVsixSetChecksums.js';
import { inspectLocalVsixSet, type LocalVsixInspector, type LocalVsixMetadataStatus } from './localVsixSetMetadata.js';

type ManifestReadResult = { readonly bytes: Uint8Array } | { readonly issue: 'size' | 'unavailable' };

function isLocalJsonFile(resource: URI): boolean {
	const { path } = resource;
	return resource.scheme === Schemas.file && !resource.authority && !resource.query && !resource.fragment
		&& path.startsWith('/') && !path.startsWith('//') && !path.includes('\0') && /\.json$/i.test(path)
		&& !path.split('/').some(segment => segment === '.' || segment === '..')
		&& (!isWindows || (/^\/[a-z]:\//i.test(path) && !path.includes('\\') && !path.slice(3).includes(':')));
}

/** Read the chosen file via the registered local provider, with a sentinel byte to detect growth. */
async function readManifest(files: IFileService, resource: URI): Promise<ManifestReadResult> {
	try {
		const provider = files.getProvider(Schemas.file);
		if (!provider || !hasOpenReadWriteCloseCapability(provider)) {
			return { issue: 'unavailable' };
		}
		const stat = await provider.stat(resource);
		if (stat.type !== FileType.File) {
			return { issue: 'unavailable' };
		}
		if (stat.size > localVsixSetMaxBytes) {
			return { issue: 'size' };
		}

		const handle = await provider.open(resource, { create: false });
		try {
			const buffer = new Uint8Array(localVsixSetMaxBytes + 1);
			let offset = 0;
			while (offset < buffer.length) {
				const length = await provider.read(handle, offset, buffer, offset, buffer.length - offset);
				if (!length) {
					return { bytes: buffer.subarray(0, offset) };
				}
				offset += length;
			}
			return { issue: 'size' };
		} finally {
			await provider.close(handle);
		}
	} catch {
		return { issue: 'unavailable' };
	}
}

function describeIssue(issue: LocalVsixSetIssue): string {
	switch (issue.kind) {
		case 'size': return localize('vsixSetSize', "Choose a manifest no larger than 64 KiB.");
		case 'json': return localize('vsixSetInvalidJson', "The manifest must be a valid UTF-8 JSON file.");
		case 'schema': return localize('vsixSetSchema', "The manifest must contain a version of 1 and an entries array.");
		case 'entryCount': return localize('vsixSetEntryCount', "The manifest must list between 1 and {0} packages.", localVsixSetMaxEntries);
		case 'entry': return localize('vsixSetInvalidEntry', "Entry {0} must contain id (publisher.name), version (an exact version), file (a local .vsix filename), and sha256 (64 hexadecimal digits).", issue.entryNumber);
		case 'duplicateId': return localize('vsixSetDuplicateId', "Entry {0} repeats an extension ID.", issue.entryNumber);
		case 'duplicateFile': return localize('vsixSetDuplicateFile', "Entry {0} repeats a VSIX filename.", issue.entryNumber);
	}
}

function describeMetadata(set: ILocalVsixSet, statuses: readonly LocalVsixMetadataStatus[]): string {
	const label = (matches: boolean) => matches
		? localize('vsixMetadataMatch', "Match")
		: localize('vsixMetadataMismatch', "Mismatch");
	return [
		localize('vsixMetadataScope', "Signatures, platform compatibility, and installation safety are unverified."),
		...set.entries.map((entry, index) => {
			const status = statuses[index];
			if (status.kind !== 'checked') {
				const unavailable = status.kind === 'missing'
					? localize('vsixMetadataFileMissing', "File missing")
					: localize('vsixMetadataUnavailable', "Unavailable");
				return localize('vsixMetadataUninspectedEntry', "{0} · {1}\n{2} — {3}", entry.id, entry.version, entry.file, unavailable);
			}
			const actual = status.inspection;
			return [
				entry.file,
				localize('vsixMetadataId', "ID: {0} (declared {1}) — {2}", actual.id, entry.id, label(status.idMatches)),
				localize('vsixMetadataVersion', "Version: {0} (declared {1}) — {2}", actual.version, entry.version, label(status.versionMatches)),
				localize('vsixMetadataSha256', "SHA-256: {0} (declared {1}) — {2}", actual.sha256, entry.sha256, label(status.sha256Matches)),
				localize('vsixMetadataEngine', "Required editor version: {0}", actual.engine),
			].join('\n');
		}),
	].join('\n\n');
}

class PreviewLocalVsixSetAction extends Action2 {
	private previewInProgress = false;

	constructor(private readonly createInspector: (accessor: ServicesAccessor) => LocalVsixInspector) {
		super({
			id: 'myself.extensions.previewLocalVsixSet',
			title: localize2('previewLocalVsixSet', "Preview Local VSIX Set…"),
			f1: false,
			menu: {
				id: MenuId.ViewContainerTitle,
				when: ContextKeyExpr.equals('viewContainer', VIEWLET_ID),
				group: '3_install',
				order: 2,
			},
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		if (this.previewInProgress) {
			return;
		}
		const fileDialog = accessor.get(IFileDialogService);
		const files = accessor.get(IFileService);
		const dialogs = accessor.get(IDialogService);
		const progress = accessor.get(IProgressService);
		const inspect = this.createInspector(accessor);
		const title = localize('localVsixSetTitle', "Local VSIX Set");
		const errorTitle = localize('vsixSetCouldNotPreview', "Could not preview the VSIX set");
		this.previewInProgress = true;
		try {
			const selection = await fileDialog.showOpenDialog({
				title: localize('selectVsixSet', "Select a Local VSIX Set Manifest"),
				openLabel: localize('previewVsixSetButton', "Preview"),
				availableFileSystems: [Schemas.file],
				filters: [{ name: localize('vsixSetJsonFilter', "JSON Files"), extensions: ['json'] }],
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
			});
			if (!selection?.length) {
				return;
			}
			if (selection.length !== 1 || !isLocalJsonFile(selection[0])) {
				await dialogs.error(errorTitle, localize('vsixSetInvalidSelection', "Select one local .json file."));
				return;
			}

			const resource = selection[0];
			const read = await readManifest(files, resource);
			if (hasKey(read, { issue: true })) {
				await dialogs.error(errorTitle, read.issue === 'size'
					? describeIssue({ kind: 'size' })
					: localize('vsixSetReadFailed', "The selected manifest could not be opened as a regular local file."));
				return;
			}
			const manifest = parseLocalVsixSet(read.bytes);
			if (hasKey(manifest, { issue: true })) {
				await dialogs.error(errorTitle, describeIssue(manifest.issue));
				return;
			}

			const detail = [
				localize('vsixSetPreviewStatus', "Package files, hashes, and signatures are unverified."),
				localize('vsixSetChecksumConsent', "Check SHA-256 reads only the listed VSIX files beside the manifest. Archives must be no larger than {0} MiB. The total read limit is {1} MiB.", localVsixArchiveMaxMiB, localVsixSetReadMaxMiB),
				localize('vsixSetMetadataConsent', "Inspect VSIX Metadata compares the ID, version, and SHA-256 of those same files from temporary copies. The same per-file and total source size limits apply."),
				...manifest.set.entries.map(entry => localize('vsixSetEntryPreview', "{0} · {1}\nFile: {2}\nDeclared SHA-256: {3}", entry.id, entry.version, entry.file, entry.sha256)),
			].join('\n\n');
			const { result } = await dialogs.prompt<'checksums' | 'metadata'>({
				type: 'info', message: title, detail, custom: true,
				buttons: [
					{ label: localize('checkVsixSetChecksums', "Check SHA-256"), run: () => 'checksums' },
					{ label: localize('inspectVsixSetMetadata', "Inspect VSIX Metadata"), run: () => 'metadata' },
				],
				cancelButton: localize('closeVsixPreview', "Close"),
			});
			if (result !== 'checksums' && result !== 'metadata') {
				return;
			}

			const cancellation = new CancellationTokenSource();
			try {
				const token = cancellation.token;
				if (result === 'metadata') {
					const registrations = files.onDidChangeFileSystemProviderRegistrations(event => {
						if (event.scheme === Schemas.file) {
							cancellation.cancel();
						}
					});
					try {
						const statuses = await progress.withProgress({
							location: ProgressLocation.Notification,
							title: localize('inspectingVsixSetMetadata', "Inspecting Local VSIX Metadata"),
							cancellable: true,
						}, () => inspectLocalVsixSet(files, inspect, dirname(resource), manifest.set, token), () => cancellation.cancel());
						if (statuses && !token.isCancellationRequested) {
							await dialogs.prompt({
								type: 'info', message: localize('vsixMetadataResultsTitle', "Local VSIX Metadata"),
								detail: describeMetadata(manifest.set, statuses), custom: true, token,
							});
						}
					} finally {
						registrations.dispose();
					}
					return;
				}
				const checksums = await progress.withProgress({
					location: ProgressLocation.Notification,
					title: localize('checkingVsixSetChecksums', "Checking Local VSIX Checksums"),
					cancellable: true,
				}, () => checkLocalVsixSetChecksums(files, dirname(resource), manifest.set, token), () => cancellation.cancel());
				if (!checksums || token.isCancellationRequested) {
					return;
				}

				const statuses = {
					match: localize('vsixChecksumMatch', "Match"),
					mismatch: localize('vsixChecksumMismatch', "Mismatch"),
					missing: localize('vsixChecksumMissing', "File missing"),
					unavailable: localize('vsixChecksumUnavailable', "Unavailable"),
				};
				const results = [
					localize('vsixChecksumResultsScope', "Checksum matches do not verify a package signature or installation safety."),
					...manifest.set.entries.map((entry, index) => localize('vsixChecksumResult', "{0} · {1}\n{2} — {3}", entry.id, entry.version, entry.file, statuses[checksums[index]])),
				].join('\n\n');
				await dialogs.prompt({ type: 'info', message: localize('vsixChecksumResultsTitle', "Local VSIX Checksums"), detail: results, custom: true });
			} finally {
				cancellation.dispose();
			}
		} finally {
			this.previewInProgress = false;
		}
	}
}

export function registerLocalVsixSetPreviewAction(createInspector: (accessor: ServicesAccessor) => LocalVsixInspector): IDisposable {
	return registerAction2(class extends PreviewLocalVsixSetAction {
		constructor() {
			super(createInspector);
		}
	});
}
