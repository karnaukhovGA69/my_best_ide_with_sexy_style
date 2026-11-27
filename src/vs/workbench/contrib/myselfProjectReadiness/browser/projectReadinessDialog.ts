/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { equals } from '../../../../base/common/arrays.js';
import { raceCancellation } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, type ICommandService } from '../../../../platform/commands/common/commands.js';
import type { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import type { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import type { IFileService } from '../../../../platform/files/common/files.js';
import type { IWorkspaceContextService, IWorkspaceFolderData } from '../../../../platform/workspace/common/workspace.js';
import type { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { evaluateProjectReadiness } from '../common/projectReadiness.js';
import { basedPyrightPythonPathKey, collectProjectReadiness, pythonInterpreterKey } from './projectReadinessCollector.js';

type Readiness = ReturnType<typeof evaluateProjectReadiness>;
type LocalAssessment = Extract<Readiness['folders'][number], { kind: 'local' }>;
const choosePythonInterpreterCommand = 'myself.project.setDefaultPythonInterpreter';

/** Render the configuration's scope without showing its raw value. */
function describeInterpreter(setting: LocalAssessment['python']['interpreter']): string {
	const sources = {
		'user': localize('interpreterUser', "User Settings"),
		'workspace': localize('interpreterWorkspace', "Workspace Settings"),
		'workspace-folder': localize('interpreterFolder', "Folder Settings"),
		'unknown': localize('interpreterUnknownSource', "Unknown Source"),
	};
	switch (setting.kind) {
		case 'absolute':
			return localize('interpreterAbsolute', "Absolute path ({0})", sources[setting.source]);
		case 'folder-relative':
			return localize('interpreterRelative', "Folder-relative path ({0})", sources[setting.source]);
		case 'unresolved':
		case 'different-folder':
			return localize('interpreterUnresolved', "Configured, path unresolved ({0})", sources[setting.source]);
		case 'unset':
			return localize('interpreterUnset', "No explicit setting");
		case 'unknown':
			return localize('interpreterUnknown', "Not checked");
	}
}

/** Keep workspace-controlled labels on a single plain-text line. */
function folderLabel(value: string): string {
	return value.replaceAll(/\s+|\p{Bidi_Control}/gu, ' ').trim();
}

/** Build read-only plain-text details for the workbench dialog. */
function describeReadiness(result: Readiness, roots: readonly IWorkspaceFolderData[]): string {
	const sections = [localize('projectReadinessSummary', "This check reports root markers and Python settings. The project language, tools, and interpreter availability are unverified.")];
	if (result.execution === 'blocked-by-workspace-trust') {
		sections.push(localize('projectReadinessRestricted', "Restricted Mode is active. Folder metadata and interpreter settings were skipped."));
	}
	if (!roots.length) {
		sections.push(localize('projectReadinessNoFolders', "Open a folder to check its project markers."));
	}

	const statuses = {
		'present': localize('markerPresent', "Found"),
		'absent': localize('markerAbsent', "Missing"),
		'unknown': localize('markerUnknown', "Not checked"),
		'wrong-type': localize('markerWrongType', "Unexpected type"),
		'unverified-link': localize('markerLink', "Symbolic link, target unverified"),
	};
	const byRoot = new Map(result.folders.map(assessment => [assessment.folder, assessment]));
	for (const { uri, name } of roots) {
		const label = folderLabel(name) || localize('projectReadinessFolder', "Workspace Folder");
		const folder = byRoot.get(uri);
		if (folder?.kind !== 'local') {
			sections.push(label + '\n' + localize('projectReadinessUnsupported', "Not checked. This folder is outside the supported local file scope."));
			continue;
		}
		const heading = localize('projectReadinessRootLabel', "{0} ({1})", label, folderLabel(uri.fsPath));
		const markers = { ...folder.python.markers, ...folder.c.buildMarkers, 'compile_commands.json': folder.c.compilationDatabase };
		const markerLines = Object.entries(markers).map(([marker, status]) => localize('projectReadinessMarker', "{0} — {1}", marker, statuses[status]));
		const interpreter = localize('projectReadinessDefaultInterpreter', "Default Python Interpreter Setting — {0}", describeInterpreter(folder.python.interpreter));
		const lines = [heading, ...markerLines, interpreter];
		if (folder.python.basedPyright) {
			lines.push(localize('projectReadinessBasedPyrightPath', "BasedPyright Python Path — {0}", describeInterpreter(folder.python.basedPyright)));
		}
		sections.push(lines.join('\n'));
	}
	return sections.join('\n\n');
}

/** Run a single explicit check and discard results invalidated while the dialog is pending. */
export class ProjectReadinessDialog extends Disposable {
	private readonly active = this._register(new MutableDisposable<CancellationTokenSource>());

	constructor(
		private readonly context: Pick<IWorkspaceContextService, 'getWorkspace' | 'getWorkbenchState' | 'onDidChangeWorkspaceFolders' | 'onDidChangeWorkbenchState'>,
		private readonly trust: Pick<IWorkspaceTrustManagementService, 'isWorkspaceTrusted' | 'onDidChangeTrust' | 'workspaceTrustInitialized'>,
		private readonly configuration: Pick<IConfigurationService, 'inspect' | 'onDidChangeConfiguration'>,
		private readonly files: Pick<IFileService, 'getProvider' | 'onDidChangeFileSystemProviderRegistrations'>,
		private readonly dialogs: Pick<IDialogService, 'prompt'>,
		private readonly commands: Pick<ICommandService, 'executeCommand'>,
		private readonly isRemote: boolean,
	) {
		super();
		const invalidate = () => this.active.value?.cancel();
		this._register(this.context.onDidChangeWorkspaceFolders(invalidate));
		this._register(this.context.onDidChangeWorkbenchState(invalidate));
		this._register(this.trust.onDidChangeTrust(invalidate));
		this._register(this.configuration.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(pythonInterpreterKey) || event.affectsConfiguration(basedPyrightPythonPathKey)) {
				invalidate();
			}
		}));
		this._register(this.files.onDidChangeFileSystemProviderRegistrations(event => {
			if (event.scheme === Schemas.file) {
				invalidate();
			}
		}));
	}

	override dispose(): void {
		this.active.value?.cancel();
		super.dispose();
	}

	async run(): Promise<void> {
		if (this._store.isDisposed || this.active.value) {
			return;
		}
		const request = new CancellationTokenSource();
		this.active.value = request;
		const { token } = request;
		try {
			const { id, folders } = this.context.getWorkspace();
			const roots = folders.map(({ uri, name, index }) => ({ uri, name, index }));
			const workbenchState = this.context.getWorkbenchState();
			const isCurrent = (trusted: boolean) => {
				if (token.isCancellationRequested || this._store.isDisposed || this.trust.isWorkspaceTrusted() !== trusted) {
					return false;
				}
				const currentWorkspace = this.context.getWorkspace();
				return id === currentWorkspace.id && workbenchState === this.context.getWorkbenchState()
					&& equals(roots, currentWorkspace.folders, (a, b) => a.uri.toString() === b.uri.toString() && a.name === b.name);
			};
			await raceCancellation(this.trust.workspaceTrustInitialized, token);
			if (token.isCancellationRequested) {
				return;
			}

			const snapshot = await collectProjectReadiness(roots, workbenchState, this.trust, this.files, this.configuration, token);
			if (!isCurrent(snapshot.isTrusted)) {
				return;
			}
			const canChooseInterpreter = snapshot.isTrusted && !this.isRemote && snapshot.folders.length > 0
				&& !!CommandsRegistry.getCommand(choosePythonInterpreterCommand);
			const { result } = await this.dialogs.prompt<boolean>({
				type: 'info',
				message: localize('projectReadinessTitle', "Project Check"),
				detail: describeReadiness(evaluateProjectReadiness(snapshot), roots),
				custom: true,
				token,
				buttons: canChooseInterpreter ? [{ label: localize('choosePythonInterpreter', "Choose Python Interpreter…"), run: () => true }] : undefined,
				cancelButton: canChooseInterpreter ? localize('closeProjectCheck', "Close") : undefined,
			});
			if (result === true && canChooseInterpreter && isCurrent(true) && CommandsRegistry.getCommand(choosePythonInterpreterCommand)) {
				await this.commands.executeCommand(choosePythonInterpreterCommand);
			}
		} finally {
			this.active.clear();
		}
	}
}
