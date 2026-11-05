/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { extUriBiasedIgnorePathCase, isEqual, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { FileOperationError, FileOperationResult, FileSystemProviderCapabilities, IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SideBySideEditor } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { mergeSettingsFile, portableSettings, settingsTransferMaxBytes } from '../common/settingsTransfer.js';

export const settingsPreviewScheme = 'myself-settings-preview';
export const ISettingsTransferService = createDecorator<ISettingsTransferService>('myselfSettingsTransferService');
export interface ISettingsTransferService {
	readonly _serviceBrand: undefined;
	exportSettings(): Promise<void>;
	importSettings(): Promise<void>;
	applySettings(resource: URI | undefined): Promise<void>;
	discardPreview(resource: URI | undefined): Promise<void>;
}

interface ISettingsSnapshot {
	readonly text: string;
	readonly exists: boolean;
	readonly etag?: string;
	readonly mtime?: number;
}
interface ISettingsPreview {
	readonly profileId: string;
	readonly settingsResource: URI;
	readonly before: URI;
	readonly after: URI;
	readonly baseline: ISettingsSnapshot;
	readonly content: string;
	readonly changed: number;
}

export class SettingsTransferService extends Disposable implements ISettingsTransferService {
	declare readonly _serviceBrand: undefined;
	private busy = false;
	private preview: ISettingsPreview | undefined;
	private readonly previewStore = this._register(new MutableDisposable<DisposableStore>());

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IUserDataProfileService private readonly profileService: IUserDataProfileService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IEditorService private readonly editorService: IEditorService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITextModelService textModelService: ITextModelService,
		@IModelService private readonly modelService: IModelService,
	) {
		super();
		this._register(textModelService.registerTextModelContentProvider(settingsPreviewScheme, {
			provideTextContent: async resource => {
				const preview = this.preview;
				const store = this.previewStore.value;
				if (!preview || !store || (!isEqual(resource, preview.before) && !isEqual(resource, preview.after))) {
					return null;
				}
				const existing = this.modelService.getModel(resource);
				if (existing) {
					return existing;
				}
				const model = store.add(this.modelService.createModel(isEqual(resource, preview.before) ? preview.baseline.text : preview.content, null, resource));
				store.add(model.onWillDispose(() => {
					if (this.preview === preview && isEqual(resource, preview.after)) {
						this.preview = undefined;
					}
				}));
				return model;
			}
		}));
	}

	private async exclusive(operation: () => Promise<void>): Promise<void> {
		if (this.busy) {
			throw new Error(localize('settingsTransfer.busy', "Another settings transfer is in progress."));
		}
		this.busy = true;
		try {
			await operation();
		} finally {
			this.busy = false;
		}
	}

	private assertClean(resource: URI): void {
		if (this.textFileService.isDirty(resource)) {
			throw new Error(localize('settingsTransfer.dirty', "Save or discard your unsaved settings changes before transferring settings."));
		}
	}

	private async readSettings(resource: URI): Promise<ISettingsSnapshot> {
		try {
			const file = await this.fileService.readFile(resource, { limits: { size: settingsTransferMaxBytes } });
			return { text: file.value.toString(), exists: true, etag: file.etag, mtime: file.mtime };
		} catch (error) {
			if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				return { text: '{}', exists: false };
			}
			throw error;
		}
	}

	private filterSettings(text: string) {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		return portableSettings(text, key => {
			const property = properties[key];
			return !property || property.restricted === true || property.ignoreSync === true
				|| property.scope === ConfigurationScope.MACHINE || property.scope === ConfigurationScope.APPLICATION_MACHINE || property.scope === ConfigurationScope.MACHINE_OVERRIDABLE;
		});
	}

	exportSettings(): Promise<void> {
		return this.exclusive(async () => {
			const profile = this.profileService.currentProfile;
			this.assertClean(profile.settingsResource);
			const source = await this.readSettings(profile.settingsResource);
			const portable = this.filterSettings(source.text.trim() ? source.text : '{}');
			const destination = await this.fileDialogService.showSaveDialog({
				title: localize('settingsTransfer.export', "Export Settings to File"),
				defaultUri: joinPath(await this.fileDialogService.defaultFilePath(Schemas.file), 'myself-settings.json'),
				filters: [{ name: 'JSON', extensions: ['json'] }],
				availableFileSystems: [Schemas.file],
			});
			if (!destination) {
				return;
			}
			if (destination.scheme !== Schemas.file || extUriBiasedIgnorePathCase.isEqual(destination.with({ scheme: profile.settingsResource.scheme, authority: profile.settingsResource.authority }), profile.settingsResource)) {
				throw new Error(localize('settingsTransfer.exportDestination', "Choose a local export file separate from your active settings.json."));
			}
			this.assertClean(destination);
			this.assertClean(profile.settingsResource);
			if (profile.id !== this.profileService.currentProfile.id) {
				throw new Error(localize('settingsTransfer.profileChanged', "The active profile changed. Start the settings transfer again."));
			}
			const latest = await this.readSettings(profile.settingsResource);
			if (latest.exists !== source.exists || latest.text !== source.text) {
				throw new Error(localize('settingsTransfer.exportChanged', "Your settings changed while choosing the export file. Export them again."));
			}
			await this.textFileService.create([{ resource: destination, value: JSON.stringify(portable.settings, null, '\t') + '\n', options: { overwrite: true } }]);
			this.notificationService.info(localize('settingsTransfer.exported', "Settings exported. {0} unregistered, machine-specific, retired, or sensitive settings were omitted.", portable.omitted.length));
		});
	}

	importSettings(): Promise<void> {
		return this.exclusive(async () => {
			if (this.preview) {
				throw new Error(localize('settingsTransfer.existingPreview', "Apply or close the current settings preview before importing another file."));
			}
			const profile = this.profileService.currentProfile;
			this.assertClean(profile.settingsResource);
			const selected = await this.fileDialogService.showOpenDialog({
				title: localize('settingsTransfer.import', "Import Settings from File"),
				canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
				filters: [{ name: 'JSON / JSONC', extensions: ['json', 'jsonc'] }], availableFileSystems: [Schemas.file],
			});
			const source = selected?.[0];
			if (!source) {
				return;
			}
			if (source.scheme !== Schemas.file) {
				throw new Error(localize('settingsTransfer.localOnly', "Choose a local settings file."));
			}
			const file = await this.fileService.readFile(source, { limits: { size: settingsTransferMaxBytes } });
			const portable = this.filterSettings(file.value.toString());
			const baseline = await this.readSettings(profile.settingsResource);
			this.assertClean(profile.settingsResource);
			if (profile.id !== this.profileService.currentProfile.id) {
				throw new Error(localize('settingsTransfer.profileChanged', "The active profile changed. Start the settings transfer again."));
			}
			const merged = mergeSettingsFile(baseline.text, portable.settings);
			if (!merged.changed) {
				this.notificationService.info(localize('settingsTransfer.unchanged', "No settings to change. {0} unregistered, machine-specific, retired, or sensitive settings were omitted.", portable.omitted.length));
				return;
			}
			const base = URI.from({ scheme: settingsPreviewScheme, path: `/${generateUuid()}` });
			this.previewStore.value = new DisposableStore();
			const preview = this.preview = { profileId: profile.id, settingsResource: profile.settingsResource, before: joinPath(base, 'current.json'), after: joinPath(base, 'import.json'), baseline, content: merged.content, changed: merged.changed };
			try {
				const opened = await this.editorService.openEditor({
					original: { resource: preview.before }, modified: { resource: preview.after },
					label: localize('settingsTransfer.preview', "Settings Import Preview"), options: { pinned: true },
				});
				if (!opened) {
					throw new Error(localize('settingsTransfer.previewUnavailable', "The settings preview could not be opened."));
				}
			} catch (error) {
				this.preview = undefined;
				this.previewStore.clear();
				throw error;
			}
			this.notificationService.info(localize('settingsTransfer.review', "Review {0} changed settings, then use Apply Imported Settings in the editor toolbar. {1} unregistered, machine-specific, retired, or sensitive settings were omitted.", merged.changed, portable.omitted.length));
		});
	}

	applySettings(resource: URI | undefined): Promise<void> {
		return this.exclusive(async () => {
			const preview = this.preview;
			if (!preview || !isEqual(resource, preview.after)) {
				throw new Error(localize('settingsTransfer.noPreview', "Open a settings import preview first."));
			}
			const previewModel = this.modelService.getModel(preview.after);
			if (previewModel && previewModel.getValue(undefined, true) !== preview.content) {
				throw new Error(localize('settingsTransfer.previewChanged', "The preview content changed. Close it and import the settings file again."));
			}
			const profile = this.profileService.currentProfile;
			if (profile.id !== preview.profileId || !isEqual(profile.settingsResource, preview.settingsResource)) {
				throw new Error(localize('settingsTransfer.profileChanged', "The active profile changed. Start the settings transfer again."));
			}
			this.assertClean(preview.settingsResource);
			const current = await this.readSettings(preview.settingsResource);
			if (current.exists !== preview.baseline.exists || current.text !== preview.baseline.text || current.etag !== preview.baseline.etag) {
				throw new Error(localize('settingsTransfer.changed', "Your settings changed after the preview was created. Close it and import the file again."));
			}
			this.assertClean(preview.settingsResource);
			if (this.profileService.currentProfile.id !== preview.profileId) {
				throw new Error(localize('settingsTransfer.profileChanged', "The active profile changed. Start the settings transfer again."));
			}
			const content = VSBuffer.fromString(preview.content);
			if (current.exists) {
				await this.fileService.writeFile(preview.settingsResource, content, { etag: current.etag, mtime: current.mtime, atomic: this.fileService.hasCapability(preview.settingsResource, FileSystemProviderCapabilities.FileAtomicWrite) ? { postfix: '.myself-settings-transfer' } : undefined });
			} else {
				await this.fileService.createFile(preview.settingsResource, content, { overwrite: false });
			}
			await this.closePreview(preview);
			this.notificationService.info(localize('settingsTransfer.applied', "Imported {0} settings into the current profile.", preview.changed));
		});
	}

	discardPreview(resource: URI | undefined): Promise<void> {
		return this.exclusive(async () => {
			if (this.preview && isEqual(resource, this.preview.after)) {
				await this.closePreview(this.preview);
			}
		});
	}

	private async closePreview(preview: ISettingsPreview): Promise<void> {
		await this.editorService.closeEditors(this.editorService.findEditors(preview.after, { supportSideBySide: SideBySideEditor.PRIMARY }));
		if (this.preview === preview) {
			this.preview = undefined;
		}
		this.previewStore.clear();
	}
}

registerSingleton(ISettingsTransferService, SettingsTransferService, InstantiationType.Delayed);
