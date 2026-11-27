/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { equals as arrayEquals } from '../../../../base/common/arrays.js';
import { raceCancellation } from '../../../../base/common/async.js';
import { CancellationTokenSource, type CancellationToken } from '../../../../base/common/cancellation.js';
import { escapeIcons } from '../../../../base/common/iconLabels.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { equals } from '../../../../base/common/objects.js';
import { joinPath } from '../../../../base/common/resources.js';
import type { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ConfigurationTarget, type IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import type { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { FileSystemProviderErrorCode, FileType, toFileSystemProviderErrorCode, type IFileService } from '../../../../platform/files/common/files.js';
import type { INotificationService } from '../../../../platform/notification/common/notification.js';
import type { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import type { IWorkspaceContextService, IWorkspaceFolderData } from '../../../../platform/workspace/common/workspace.js';
import type { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { FOLDER_CONFIG_FOLDER_NAME, FOLDER_SETTINGS_PATH } from '../../../services/configuration/common/configuration.js';
import { describeInterpreterChange, interpreterPath, isLocalPath, pythonInterpreterSetting, snapshotInterpreterSetting, supportsFolderInterpreterSetting } from './pythonInterpreterSetting.js';

interface PickerServices {
	readonly context: Pick<IWorkspaceContextService, 'getWorkspace' | 'getWorkspaceFolder' | 'getWorkbenchState' | 'onDidChangeWorkspaceFolders' | 'onDidChangeWorkbenchState'>;
	readonly trust: Pick<IWorkspaceTrustManagementService, 'workspaceTrustInitialized' | 'isWorkspaceTrusted' | 'onDidChangeTrust'>;
	readonly configuration: Pick<IConfigurationService, 'inspect' | 'keys' | 'updateValue' | 'onDidChangeConfiguration'>;
	readonly quickInput: Pick<IQuickInputService, 'pick'>;
	readonly fileDialog: Pick<IFileDialogService, 'showOpenDialog'>;
	readonly files: Pick<IFileService, 'getProvider'>;
	readonly dialogs: Pick<IDialogService, 'confirm'>;
	readonly notification: Pick<INotificationService, 'info' | 'warn' | 'error'>;
	readonly isRemote: boolean;
}

/** Select and confirm a single project-local configuration change. */
export class PythonInterpreterPicker extends Disposable {
	private readonly active = this._register(new MutableDisposable<CancellationTokenSource>());

	constructor(private readonly services: PickerServices) {
		super();
		const invalidate = () => this.active.value?.cancel();
		this._register(services.context.onDidChangeWorkspaceFolders(invalidate));
		this._register(services.context.onDidChangeWorkbenchState(invalidate));
		this._register(services.trust.onDidChangeTrust(invalidate));
		this._register(services.configuration.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(pythonInterpreterSetting)) {
				invalidate();
			}
		}));
	}

	override dispose(): void {
		this.active.value?.cancel();
		super.dispose();
	}

	async run(): Promise<void> {
		if (this._store.isDisposed || this.active.value || this.services.isRemote) {
			return;
		}
		const request = new CancellationTokenSource();
		this.active.value = request;
		const { token } = request;
		const { context, trust, configuration, notification } = this.services;
		const { id, folders } = context.getWorkspace();
		const roots = folders.map(({ uri, name, index }) => ({ uri, name, index }));
		const state = context.getWorkbenchState();
		const sameWorkspace = () => {
			const current = context.getWorkspace();
			return current.id === id && context.getWorkbenchState() === state
				&& arrayEquals(roots, current.folders, (a, b) => a.uri.toString() === b.uri.toString() && a.name === b.name);
		};
		const isCurrent = () => !token.isCancellationRequested && !this._store.isDisposed && trust.isWorkspaceTrusted() && sameWorkspace();
		const settingAvailable = () => supportsFolderInterpreterSetting() && configuration.keys().default.includes(pythonInterpreterSetting);

		try {
			await raceCancellation(trust.workspaceTrustInitialized, token);
			if (token.isCancellationRequested || !sameWorkspace()) {
				return;
			}
			if (!trust.isWorkspaceTrusted()) {
				notification.info(localize('pickerRequiresTrust', "Trust this workspace before changing its default Python interpreter."));
				return;
			}
			const localRoots = roots.filter(root => isLocalPath(root.uri));
			if (!localRoots.length) {
				notification.info(localize('pickerRequiresFolder', "Open a local folder to set its default Python interpreter."));
				return;
			}
			if (!settingAvailable()) {
				notification.info(localize('pickerRequiresPython', "The default interpreter setting is available when the Microsoft Python extension is enabled."));
				return;
			}

			const folder = roots.length > 1 ? await this.pickFolder(localRoots, token) : localRoots[0];
			if (!folder || !isCurrent()) {
				return;
			}
			const files = await this.services.fileDialog.showOpenDialog({
				title: localize('pickPythonFile', "Select Python Interpreter File"),
				openLabel: localize('selectPythonFile', "Select"),
				defaultUri: folder.uri,
				availableFileSystems: [Schemas.file],
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
			});
			if (!isCurrent() || !files?.length) {
				return;
			}
			const path = files.length === 1 ? interpreterPath(files[0]) : undefined;
			if (!path) {
				notification.warn(localize('pickerInvalidPath', "Select a local interpreter file with a literal path."));
				return;
			}

			const readSetting = () => snapshotInterpreterSetting(configuration.inspect<unknown>(pythonInterpreterSetting, { resource: folder.uri }), state);
			const setting = readSetting();
			if (setting.overridden) {
				notification.warn(localize('pickerOverridden', "This setting is controlled by system policy or the current session."));
				return;
			}
			if (setting.folderValue === path) {
				notification.info(localize('pickerUnchanged', "Folder Settings already contain this default Python path."));
				return;
			}

			const { confirmed } = await this.services.dialogs.confirm({
				type: 'info',
				message: localize('confirmPythonInterpreter', "Save Default Python Interpreter?"),
				detail: describeInterpreterChange(setting, path, folder.uri),
				primaryButton: localize('savePythonInterpreter', "Save to Folder Settings"),
				custom: true,
				token,
			});
			if (!confirmed || !isCurrent()) {
				return;
			}

			const safeDestination = await this.checkDestination(folder.uri, isCurrent);
			if (!isCurrent()) {
				return;
			}
			if (!safeDestination) {
				notification.warn(localize('pickerUnsafeDestination', "Folder Settings are unavailable or have an unexpected file type."));
				return;
			}
			if (!settingAvailable() || !equals(setting, readSetting())) {
				notification.warn(localize('pickerStaleSetting', "The interpreter setting changed. Open the picker again to review it."));
				return;
			}
			if (!isCurrent() || context.getWorkspaceFolder(folder.uri)?.uri.toString() !== folder.uri.toString()) {
				return;
			}
			await configuration.updateValue(pythonInterpreterSetting, path, { resource: folder.uri }, ConfigurationTarget.WORKSPACE_FOLDER, { donotNotifyError: true });
			if (!this._store.isDisposed && trust.isWorkspaceTrusted() && sameWorkspace()) {
				notification.info(localize('pickerSaved', "Saved the default Python path in Folder Settings."));
			}
		} catch {
			if (!token.isCancellationRequested && !this._store.isDisposed && sameWorkspace()) {
				notification.error(localize('pickerFailed', "Unable to update the default Python interpreter in Folder Settings."));
			}
		} finally {
			this.active.clear();
		}
	}

	private async pickFolder(roots: readonly IWorkspaceFolderData[], token: CancellationToken): Promise<IWorkspaceFolderData | undefined> {
		const items = roots.map(root => ({
			label: escapeIcons(root.name.replaceAll(/[\p{Cc}\p{Bidi_Control}]/gu, ' ')),
			description: escapeIcons(root.uri.fsPath.replaceAll(/[\p{Cc}\p{Bidi_Control}]/gu, ' ')),
			root,
		}));
		const item = await this.services.quickInput.pick(items, {
			placeHolder: localize('pickPythonFolder', "Choose the Project Folder to Configure"),
			matchOnDescription: true,
		}, token);
		return item && items.includes(item) ? item.root : undefined;
	}

	/** Before dispatching the edit, check the fixed settings path and reject observed links. */
	private async checkDestination(folder: URI, isCurrent: () => boolean): Promise<boolean> {
		const provider = this.services.files.getProvider(Schemas.file);
		if (!provider) {
			return false;
		}
		const paths = [
			[folder, FileType.Directory, false],
			[joinPath(folder, FOLDER_CONFIG_FOLDER_NAME), FileType.Directory, true],
			[joinPath(folder, FOLDER_SETTINGS_PATH), FileType.File, true],
		] as const;
		for (const [resource, expected, allowMissing] of paths) {
			if (!isCurrent() || this.services.files.getProvider(Schemas.file) !== provider) {
				return false;
			}
			try {
				if ((await provider.stat(resource)).type !== expected) {
					return false;
				}
			} catch (error) {
				if (!allowMissing || toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileNotFound) {
					return false;
				}
			}
		}
		return this.services.files.getProvider(Schemas.file) === provider;
	}
}
