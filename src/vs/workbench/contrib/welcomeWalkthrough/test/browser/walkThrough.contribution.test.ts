/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { MenuId, MenuRegistry, isIMenuItem } from '../../../../../platform/actions/common/actions.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import '../../browser/walkThrough.contribution.js';

suite('Interactive Playground removal', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const commands = [
		'workbench.action.showInteractivePlayground',
		'workbench.action.interactivePlayground.arrowUp',
		'workbench.action.interactivePlayground.arrowDown',
		'workbench.action.interactivePlayground.pageUp',
		'workbench.action.interactivePlayground.pageDown'
	];
	test('does not register playground commands', () => {
		for (const id of commands) { assert.strictEqual(CommandsRegistry.getCommand(id), undefined, id); }
	});
	test('does not contribute Help or command palette entries', () => {
		for (const menu of [MenuId.MenubarHelpMenu, MenuId.CommandPalette]) {
			assert.strictEqual(MenuRegistry.getMenuItems(menu).some(item => isIMenuItem(item) && commands.includes(item.command.id)), false);
		}
	});
	test('does not bind navigation keys to playground commands', () => {
		assert.strictEqual(KeybindingsRegistry.getDefaultKeybindings().some(item => commands.includes(item.command ?? '')), false);
	});
});
