/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { TerminalContextKeys } from '../../terminal/common/terminalContextKey.js';

const editorTextSizeMenu = new MenuId('MyselfEditorTextSize');
const terminalTextSizeMenu = new MenuId('MyselfTerminalTextSize');

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	title: localize('editorTextSize', "Editor Text Size"),
	submenu: editorTextSizeMenu,
	group: '2_configuration',
	order: 9,
});

MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	title: localize('terminalTextSize', "Text Size"),
	submenu: terminalTextSizeMenu,
	group: '3_configuration',
	order: 1,
	when: TerminalContextKeys.processSupported,
});

// Reuse the font commands so window zoom and unrelated settings are unaffected.
for (const [index, action] of [
	{ editor: 'editor.action.fontZoomIn', terminal: 'workbench.action.terminal.fontZoomIn', title: localize('increaseTextSize', "Increase") },
	{ editor: 'editor.action.fontZoomOut', terminal: 'workbench.action.terminal.fontZoomOut', title: localize('decreaseTextSize', "Decrease") },
	{ editor: 'editor.action.fontZoomReset', terminal: 'workbench.action.terminal.fontZoomReset', title: localize('resetTextSize', "Reset") },
].entries()) {
	MenuRegistry.appendMenuItem(editorTextSizeMenu, {
		command: { id: action.editor, title: action.title },
		order: index + 1,
	});
	MenuRegistry.appendMenuItem(terminalTextSizeMenu, {
		command: { id: action.terminal, title: action.title, precondition: TerminalContextKeys.processSupported },
		order: index + 1,
	});
}
