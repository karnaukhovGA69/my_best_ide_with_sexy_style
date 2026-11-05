/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { URI } from '../../../../base/common/uri.js';
import { localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ISettingsTransferService, settingsPreviewScheme } from './settingsTransferService.js';

const previewContext = ContextKeyExpr.and(ResourceContextKey.Scheme.isEqualTo(settingsPreviewScheme), ResourceContextKey.Filename.isEqualTo('import.json'));

for (const action of [
	{ id: 'myself.settings.exportFile', title: localize2('settingsTransfer.export', "Export Settings to File..."), icon: Codicon.export, mode: 'export' },
	{ id: 'myself.settings.importFile', title: localize2('settingsTransfer.import', "Import Settings from File..."), icon: Codicon.folderOpened, mode: 'import' },
	{ id: 'myself.settings.applyImport', title: localize2('settingsTransfer.apply', "Apply Imported Settings"), icon: Codicon.check, mode: 'apply' },
	{ id: 'myself.settings.discardImport', title: localize2('settingsTransfer.discard', "Discard Settings Import"), icon: Codicon.close, mode: 'discard' },
] as const) {
	const previewAction = action.mode === 'apply' || action.mode === 'discard';
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: action.id, title: action.title, icon: action.icon, category: Categories.Preferences, f1: true,
				precondition: previewAction ? previewContext : undefined,
				menu: previewAction ? [{ id: MenuId.EditorTitle, group: 'navigation', order: action.mode === 'apply' ? 1 : 2, when: previewContext }] : [
					{ id: MenuId.MenubarPreferencesMenu, group: '3_settings_transfer', order: action.mode === 'export' ? 1 : 2 },
					{ id: MenuId.GlobalActivity, group: '3_settings_transfer', order: action.mode === 'export' ? 1 : 2 },
				],
			});
		}
		async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
			const service = accessor.get(ISettingsTransferService);
			const notifications = accessor.get(INotificationService);
			const activeResource = URI.isUri(resource) ? resource : EditorResourceAccessor.getOriginalUri(accessor.get(IEditorService).activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
			try {
				switch (action.mode) {
					case 'export': await service.exportSettings(); break;
					case 'import': await service.importSettings(); break;
					case 'apply': await service.applySettings(activeResource); break;
					case 'discard': await service.discardPreview(activeResource); break;
				}
			} catch (error) {
				notifications.error(error);
			}
		}
	});
}
