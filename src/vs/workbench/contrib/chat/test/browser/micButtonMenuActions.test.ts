/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { addMicButtonContextMenuListener, getDictationContextMenuActions, getVoiceModeContextMenuActions } from '../../browser/speechToText/micButtonMenuActions.js';

suite('Mic button menus unavailable', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('offers no actions and never reads command, configuration or keybinding services', () => {
		const unreadable = { get: () => { throw new Error('Service must not be read'); } };
		const commands = new Proxy({} as ICommandService, unreadable);
		const config = new Proxy({} as IConfigurationService, unreadable);
		const keybindings = new Proxy({} as IKeybindingService, unreadable);
		assert.deepStrictEqual(getDictationContextMenuActions(commands, config, keybindings, 'dictation.start'), []);
		assert.deepStrictEqual(getVoiceModeContextMenuActions(commands, config, keybindings, 'voice.start'), []);
	});

	test('does not intercept context menus or invoke callbacks', () => {
		const container = document.createElement('div');
		const button = container.appendChild(document.createElement('button'));
		const contextMenus = new Proxy({} as IContextMenuService, { get: () => { throw new Error('Context menu service must not be read'); } });
		const registration = addMicButtonContextMenuListener(button, () => { throw new Error('Actions must not be requested'); }, contextMenus);
		assert.strictEqual(registration, Disposable.None);
		let bubbled = 0;
		container.addEventListener('contextmenu', () => bubbled++);
		for (let i = 0; i < 2; i++) {
			const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
			assert.strictEqual(button.dispatchEvent(event), true);
			assert.strictEqual(event.defaultPrevented, false);
			registration.dispose();
		}
		assert.strictEqual(bubbled, 2);
	});
});
