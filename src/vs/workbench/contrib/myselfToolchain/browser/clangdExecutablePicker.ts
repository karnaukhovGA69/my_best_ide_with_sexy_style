/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { raceCancellation } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, MutableDisposable, type IDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { equals } from '../../../../base/common/objects.js';
import { joinPath } from '../../../../base/common/resources.js';
import type { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ConfigurationTarget, type IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope, Extensions, type IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import type { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier, type IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { FileSystemProviderErrorCode, FileType, toFileSystemProviderErrorCode, type IFileService, type IFileSystemProvider, type IStat } from '../../../../platform/files/common/files.js';
import type { INotificationService } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { WorkbenchState, type IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import type { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { RemoteNameContext, WorkbenchStateContext, WorkspaceFolderCountContext } from '../../../common/contextkeys.js';
import { FOLDER_CONFIG_FOLDER_NAME, FOLDER_SETTINGS_PATH } from '../../../services/configuration/common/configuration.js';
import { VIEW_ID } from '../../files/common/files.js';
import { WorkspaceTrustContext } from '../../workspace/common/workspace.js';
import { interpreterPath as literalExecutablePath, isLocalPath, snapshotInterpreterSetting } from './pythonInterpreterSetting.js';

const clientId = 'llvm-vs-code-extensions.vscode-clangd';
const reviewedVersion = '0.6.0';
const clangdPath = 'clangd.path';
const clangdUpdates = 'clangd.checkUpdates';
const clangdScript = 'clangd.useScriptAsExecutable';
const settings = [
	{ key: clangdPath, type: 'string', scope: ConfigurationScope.MACHINE_OVERRIDABLE },
	{ key: clangdUpdates, type: 'boolean', scope: ConfigurationScope.WINDOW },
	{ key: clangdScript, type: 'boolean', scope: ConfigurationScope.MACHINE_OVERRIDABLE },
] as const;

interface ClangdPickerServices {
	readonly context: Pick<IWorkspaceContextService, 'getWorkspace' | 'getWorkspaceFolder' | 'getWorkbenchState' | 'onDidChangeWorkspaceFolders' | 'onDidChangeWorkbenchState'>;
	readonly trust: Pick<IWorkspaceTrustManagementService, 'workspaceTrustInitialized' | 'isWorkspaceTrusted' | 'onDidChangeTrust'>;
	readonly configuration: Pick<IConfigurationService, 'inspect' | 'keys' | 'updateValue' | 'onDidChangeConfiguration'>;
	readonly registeredExtensions: () => readonly Pick<IExtensionDescription, 'identifier' | 'version' | 'extensionLocation'>[];
	readonly fileDialog: Pick<IFileDialogService, 'showOpenDialog'>;
	readonly files: Pick<IFileService, 'getProvider'>;
	readonly dialogs: Pick<IDialogService, 'confirm'>;
	readonly notification: Pick<INotificationService, 'info' | 'warn' | 'error'>;
	readonly isRemote: boolean;
}

/** Map a regular selected file to metadata that can be compared after confirmation. */
async function regularStat(provider: IFileSystemProvider, candidate: URI): Promise<IStat | undefined> {
	try {
		const stat = await provider.stat(candidate);
		return stat.type === FileType.File ? stat : undefined;
	} catch {
		return undefined;
	}
}

async function checkDestination(provider: IFileSystemProvider, folder: URI, isCurrent: () => boolean): Promise<boolean> {
	const parts = [
		[folder, FileType.Directory, false],
		[joinPath(folder, FOLDER_CONFIG_FOLDER_NAME), FileType.Directory, true],
		[joinPath(folder, FOLDER_SETTINGS_PATH), FileType.File, true],
	] as const;
	for (const [path, type, allowMissing] of parts) {
		if (!isCurrent()) {
			return false;
		}
		try {
			if ((await provider.stat(path)).type !== type) {
				return false;
			}
		} catch (error) {
			if (!allowMissing || toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileNotFound) {
				return false;
			}
		}
	}
	return isCurrent();
}

function describeValue(value: unknown): string {
	if (typeof value === 'string') {
		return JSON.stringify(value).replaceAll(/[\p{Bidi_Control}\u2028\u2029]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
	}
	return value === undefined ? localize('clangdUnset', "Unset") : localize('clangdNonText', "Non-text value");
}

/** Configure the reviewed clangd client in a single-folder local window. */
export class ClangdExecutablePicker extends Disposable {
	private readonly active = this._register(new MutableDisposable<CancellationTokenSource>());

	constructor(private readonly services: ClangdPickerServices) {
		super();
		const invalidate = () => this.active.value?.cancel();
		this._register(services.context.onDidChangeWorkspaceFolders(invalidate));
		this._register(services.context.onDidChangeWorkbenchState(invalidate));
		this._register(services.trust.onDidChangeTrust(invalidate));
		this._register(services.configuration.onDidChangeConfiguration(event => {
			if (settings.some(({ key }) => event.affectsConfiguration(key))) {
				invalidate();
			}
		}));
	}

	override dispose(): void {
		this.active.value?.cancel();
		super.dispose();
	}

	private readWindowSettings() {
		const { configuration, registeredExtensions } = this.services;
		const client = registeredExtensions().find(candidate => ExtensionIdentifier.equals(candidate.identifier, clientId));
		if (!client || client.version !== reviewedVersion || !isLocalPath(client.extensionLocation)) {
			return undefined;
		}
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		const defaults = configuration.keys().default;
		if (!settings.every(({ key, type, scope }) => {
			const property = properties[key];
			return defaults.includes(key) && !!property && typeof property.source === 'object' && property.source.id.toLowerCase() === clientId
				&& property.type === type && property.scope === scope;
		})) {
			return undefined;
		}

		// vscode-clangd 0.6.0 reads workspace.getConfiguration('clangd') without a resource.
		return {
			client: client.extensionLocation.toString(),
			path: snapshotInterpreterSetting(configuration.inspect<unknown>(clangdPath), WorkbenchState.FOLDER),
			updates: configuration.inspect<unknown>(clangdUpdates).value,
			script: configuration.inspect<unknown>(clangdScript).value,
		};
	}

	async run(): Promise<void> {
		if (this._store.isDisposed || this.active.value || this.services.isRemote) {
			return;
		}
		const { context, trust, configuration, fileDialog, files, dialogs, notification } = this.services;
		const request = new CancellationTokenSource();
		this.active.value = request;
		const { token } = request;
		try {
			await raceCancellation(trust.workspaceTrustInitialized, token);
			if (token.isCancellationRequested || !trust.isWorkspaceTrusted() || this._store.isDisposed) {
				return;
			}
			const { id: workspaceId, folders } = context.getWorkspace();
			const folder = folders[0]?.uri;
			if (context.getWorkbenchState() !== WorkbenchState.FOLDER || folders.length !== 1 || !folder || !isLocalPath(folder)) {
				notification.info(localize('clangdSingleFolder', "Open one local folder directly to configure its clangd executable."));
				return;
			}
			const sameFolder = () => {
				const current = context.getWorkspace();
				return current.id === workspaceId && context.getWorkbenchState() === WorkbenchState.FOLDER && current.folders.length === 1
					&& current.folders[0].uri.toString() === folder.toString();
			};
			const isCurrent = () => !token.isCancellationRequested && !this._store.isDisposed && trust.isWorkspaceTrusted() && sameFolder();

			const before = this.readWindowSettings();
			if (!before) {
				notification.info(localize('clangdClientRequired', "Enable the reviewed clangd extension version {0} with its standard settings to use this action.", reviewedVersion));
				return;
			}
			if (before.path.overridden || before.updates !== false || before.script !== false) {
				notification.warn(localize('clangdUnderlyingSettings', "Use a clangd path that Folder Settings can override and turn off clangd.checkUpdates and clangd.useScriptAsExecutable before choosing a file."));
				return;
			}
			const selected = await fileDialog.showOpenDialog({
				title: localize('clangdSelectExecutable', "Select clangd Executable"),
				openLabel: localize('clangdSelect', "Select"),
				defaultUri: folder,
				availableFileSystems: [Schemas.file],
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
			});
			if (!isCurrent() || !selected?.length) {
				return;
			}
			const candidate = selected[0];
			const path = selected.length === 1 ? literalExecutablePath(candidate) : undefined;
			const provider = path ? files.getProvider(Schemas.file) : undefined;
			if (!path || !provider) {
				notification.warn(localize('clangdInvalidCandidate', "Choose an existing regular local file with a literal absolute path."));
				return;
			}
			const canCheckFiles = () => isCurrent() && files.getProvider(Schemas.file) === provider;
			const initial = await regularStat(provider, candidate);
			if (!canCheckFiles()) {
				return;
			}
			if (!initial) {
				notification.warn(localize('clangdInvalidCandidate', "Choose an existing regular local file with a literal absolute path."));
				return;
			}
			if (!equals(before, this.readWindowSettings())) {
				notification.warn(localize('clangdStaleSetting', "The clangd settings or registered extension changed. Open the picker again to review them."));
				return;
			}
			if (before.path.folderValue === path && before.path.current === path) {
				notification.info(localize('clangdUnchanged', "Folder Settings already use this clangd path."));
				return;
			}
			const { confirmed } = await dialogs.confirm({
				type: 'warning',
				message: localize('confirmClangdExecutable', "Save This clangd Executable Path?"),
				detail: [
					localize('clangdFolder', "Project Folder — {0}", describeValue(folder.fsPath)),
					localize('clangdEffectivePath', "Effective Window Value — {0}", describeValue(before.path.current)),
					localize('clangdFolderPath', "Folder Settings (.vscode/settings.json) — clangd.path\n{0} → {1}", describeValue(before.path.folderValue), describeValue(path)),
					localize('clangdActivationConsequences', "The clangd client may execute this file the next time it starts. If the path is inaccessible then, clangd 0.6.0 may contact GitHub for recovery, even with automatic update checks turned off."),
				].join('\n\n'),
				primaryButton: localize('saveClangdExecutable', "Save to Folder Settings"),
				custom: true,
				token,
			});
			if (!confirmed || !canCheckFiles()) {
				return;
			}
			const safeDestination = await checkDestination(provider, folder, canCheckFiles);
			if (!canCheckFiles()) {
				return;
			}
			if (!safeDestination) {
				notification.warn(localize('clangdUnsafeDestination', "Folder Settings are unavailable or have an unexpected file type."));
				return;
			}
			const current = await regularStat(provider, candidate);
			if (!canCheckFiles()) {
				return;
			}
			if (!equals(initial, current) || !equals(before, this.readWindowSettings()) || context.getWorkspaceFolder(folder)?.uri.toString() !== folder.toString()) {
				notification.warn(localize('clangdStaleSelection', "The file or clangd settings changed. Open the picker again before saving."));
				return;
			}
			if (!canCheckFiles()) {
				return;
			}
			await configuration.updateValue(clangdPath, path, { resource: folder }, ConfigurationTarget.WORKSPACE_FOLDER, { donotNotifyError: true });
			if (!this._store.isDisposed && trust.isWorkspaceTrusted() && sameFolder()) {
				if (configuration.inspect<unknown>(clangdPath).value === path) {
					notification.info(localize('clangdSaved', "Saved clangd.path in Folder Settings. The client reads it during initialization."));
				} else {
					notification.warn(localize('clangdWindowValueChanged', "Saved Folder Settings, but the effective clangd path in this window differs. Review the current settings."));
				}
			}
		} catch {
			if (!token.isCancellationRequested && !this._store.isDisposed && trust.isWorkspaceTrusted()) {
				notification.error(localize('clangdSaveFailed', "Unable to update the clangd path in Folder Settings."));
			}
		} finally {
			this.active.clear();
		}
	}
}

export function registerClangdExecutablePickerAction(picker: Pick<ClangdExecutablePicker, 'run'>): IDisposable {
	return registerAction2(class extends Action2 {
		constructor() {
			super({
				id: 'myself.project.configureClangdExecutable',
				title: localize2('pickProjectClangd', "Configure Project clangd…"),
				icon: Codicon.settingsGear,
				precondition: ContextKeyExpr.and(WorkspaceTrustContext.IsTrusted, RemoteNameContext.isEqualTo(''), WorkbenchStateContext.isEqualTo('folder'), WorkspaceFolderCountContext.isEqualTo(1)),
				f1: false,
				menu: [
					{ id: MenuId.MenubarTerminalMenu, group: '2_project', order: 6 },
					{ id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', VIEW_ID), group: 'navigation', order: 6 },
				],
			});
		}

		override run(): Promise<void> {
			return picker.run();
		}
	});
}
