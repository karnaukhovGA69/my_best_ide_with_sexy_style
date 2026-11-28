/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { raceCancellation } from '../../../../base/common/async.js';
import { cancelOnDispose, CancellationTokenSource, type CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore, type IDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import type { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { FileType, IFileService, type IFileSystemProvider } from '../../../../platform/files/common/files.js';
import type { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { RemoteNameContext } from '../../../common/contextkeys.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IExtensionsWorkbenchService, VIEWLET_ID } from '../../extensions/common/extensions.js';
import type { InstallationDiagnosticsProfileTracker } from '../../myselfDiagnostics/browser/installationDiagnosticsReader.js';
import { localVsixArchiveMaxMiB } from './localVsixSetChecksums.js';
import { isLocalVsixInspection, type LocalVsixInspector } from './localVsixSetMetadata.js';
import { compareLocalVsixVersion, type LocalVsixVersionComparison } from './localVsixVersionComparison.js';

type ProfileInventory = Pick<InstallationDiagnosticsProfileTracker, 'revision' | 'inventoryStatus' | 'profileName'>;

function isLocalVsixFile(resource: URI): boolean {
	return resource.scheme === Schemas.file && !resource.authority && !resource.query && !resource.fragment
		&& resource.path.startsWith('/') && resource.path.toLowerCase().endsWith('.vsix') && !/[\\\0]/.test(resource.path)
		&& !resource.path.slice(1).split('/').some(segment => !segment || segment === '.' || segment === '..');
}

function describeComparison(kind: LocalVsixVersionComparison['kind']): string {
	switch (kind) {
		case 'exact': return localize('localVsixVersionExact', "Exact version match.");
		case 'equalPrecedence': return localize('localVsixVersionEqualPrecedence', "Equal SemVer precedence with different version strings.");
		case 'newer': return localize('localVsixVersionNewer', "The VSIX version is newer.");
		case 'older': return localize('localVsixVersionOlder', "The VSIX version is older.");
		case 'unknown': return localize('localVsixVersionUnknownComparison', "The active profile's cached list did not provide one matching version.");
	}
}

class CompareLocalVsixVersionAction extends Action2 {
	private inProgress = false;

	constructor(
		private readonly createInspector: (accessor: ServicesAccessor) => LocalVsixInspector,
		private readonly profile: ProfileInventory,
		private readonly lifetime: CancellationToken,
	) {
		super({
			id: 'myself.extensions.compareLocalVsixVersion',
			title: localize2('compareLocalVsixVersion', "Compare Local VSIX Version…"),
			f1: false,
			menu: {
				id: MenuId.ViewContainerTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('viewContainer', VIEWLET_ID), RemoteNameContext.isEqualTo('')),
				group: '3_install',
				order: 3,
			},
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		if (this.inProgress || this.lifetime.isCancellationRequested || accessor.get(IWorkbenchEnvironmentService).remoteAuthority) {
			return;
		}
		const profiles = accessor.get(IUserDataProfileService);
		const fileDialog = accessor.get(IFileDialogService);
		const files = accessor.get(IFileService);
		const dialogs = accessor.get(IDialogService);
		const progress = accessor.get(IProgressService);
		const inventory = accessor.get(IExtensionsWorkbenchService);
		const inspect = this.createInspector(accessor);
		const revision = this.profile.revision;
		const request = new CancellationTokenSource(this.lifetime);
		const token = request.token;
		const listeners = new DisposableStore();
		const isCurrent = () => !token.isCancellationRequested && revision === this.profile.revision;
		const errorTitle = localize('localVsixVersionComparisonFailed', "Could not compare the VSIX version");
		const unavailable = localize('localVsixVersionInspectionUnavailable', "Choose a regular local VSIX file up to {0} MiB that can be inspected.", localVsixArchiveMaxMiB);
		this.inProgress = true;
		try {
			listeners.add(profiles.onDidChangeCurrentProfile(() => request.cancel()));
			const selection = await fileDialog.showOpenDialog({
				title: localize('selectVsixVersionFile', "Select a Local VSIX File"),
				openLabel: localize('compareVsixVersionButton', "Compare Version"),
				availableFileSystems: [Schemas.file],
				filters: [{ name: localize('compareVsixVersionFilter', "VSIX Files"), extensions: ['vsix'] }],
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
			});
			if (!isCurrent() || !selection?.length) {
				return;
			}
			if (selection.length !== 1 || !isLocalVsixFile(selection[0])) {
				await dialogs.error(errorTitle, unavailable);
				return;
			}
			const [file] = selection;
			listeners.add(files.onDidChangeFileSystemProviderRegistrations(event => {
				if (event.scheme === Schemas.file) {
					request.cancel();
				}
			}));
			const provider = files.getProvider(Schemas.file);
			if (!provider) {
				await dialogs.error(errorTitle, unavailable);
				return;
			}
			const isFileCurrent = () => isCurrent() && files.getProvider(Schemas.file) === provider;
			const result = await progress.withProgress({
				location: ProgressLocation.Notification,
				title: localize('comparingLocalVsixVersion', "Comparing Local VSIX Version"),
				cancellable: true,
			}, () => this.inspectFile(file, provider, inspect, inventory, token, isFileCurrent), () => request.cancel());
			if (!isFileCurrent()) {
				return;
			}
			if (!result) {
				await dialogs.error(errorTitle, unavailable);
				return;
			}
			const { inspection, inventoryReady } = result;
			let comparison: LocalVsixVersionComparison = { kind: 'unknown' };
			if (inventoryReady && this.profile.inventoryStatus === 'available') {
				try {
					comparison = compareLocalVsixVersion(inspection.id, inspection.version, inventory.installed);
				} catch {
					// An unavailable cache cannot establish a comparison.
				}
			}
			const profileName = this.profile.profileName.replace(/[\s\p{Cc}\p{Bidi_Control}]+/gu, ' ').trim().slice(0, 160);
			if (!isFileCurrent()) {
				return;
			}
			await dialogs.prompt({
				type: 'info',
				custom: true,
				message: localize('localVsixVersionComparisonTitle', "Local VSIX Version Comparison"),
				detail: [
					localize('localVsixVersionExtension', "Extension: {0}", inspection.id),
					localize('localVsixVersionSelected', "VSIX version: {0}", inspection.version),
					localize('localVsixVersionSha256', "VSIX SHA-256: {0}", inspection.sha256),
					localize('localVsixVersionActiveProfile', "Active profile: {0}", profileName),
					localize('localVsixVersionCached', "Cached installed version: {0}", comparison.kind === 'unknown' ? localize('localVsixVersionUnknown', "Unknown") : comparison.installedVersion),
					describeComparison(comparison.kind),
					'',
					localize('localVsixVersionScope', "The comparison uses cached versions of profile-scoped user extensions. Package compatibility, signatures, and other profiles' use of shared extension files were not checked."),
				].join('\n'),
				token,
			});
		} finally {
			listeners.dispose();
			request.dispose();
			this.inProgress = false;
		}
	}

	private async inspectFile(
		file: URI,
		provider: IFileSystemProvider,
		inspect: LocalVsixInspector,
		inventory: Pick<IExtensionsWorkbenchService, 'whenInitialized'>,
		token: CancellationToken,
		isCurrent: () => boolean,
	) {
		try {
			if (!isCurrent()) {
				return undefined;
			}
			const before = await provider.stat(file);
			if (!isCurrent() || before.type !== FileType.File || !Number.isSafeInteger(before.size)
				|| before.size < 22 || before.size > localVsixArchiveMaxMiB * 1024 * 1024) {
				return undefined;
			}
			const inspection = await inspect(file, before.size, token);
			if (!isCurrent() || !isLocalVsixInspection(inspection, before.size)) {
				return undefined;
			}
			const inventoryReady = this.profile.inventoryStatus === 'available'
				&& await raceCancellation(inventory.whenInitialized.then(() => true, () => false), token) === true;
			if (!isCurrent()) {
				return undefined;
			}
			const after = await provider.stat(file);
			if (!isCurrent() || after.type !== FileType.File || after.size !== before.size || after.mtime !== before.mtime || after.ctime !== before.ctime) {
				return undefined;
			}
			return { inspection, inventoryReady };
		} catch {
			return undefined;
		}
	}
}

export function registerLocalVsixVersionCompareAction(createInspector: (accessor: ServicesAccessor) => LocalVsixInspector, profile: ProfileInventory): IDisposable {
	const store = new DisposableStore();
	const lifetime = cancelOnDispose(store);
	store.add(registerAction2(class extends CompareLocalVsixVersionAction {
		constructor() {
			super(createInspector, profile, lifetime);
		}
	}));
	return store;
}
