/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID, CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID, registerConfigureSpeechInstructionsActions } from '../../../browser/actions/configureVoiceInstructionsAction.js';

suite('Voice instruction actions unavailable', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('registers no commands or menu entries, including repeated registration', () => {
		const commands = Array.from(CommandsRegistry.getCommands().keys());
		const menu = MenuRegistry.getMenuItems(MenuId.CommandPalette);
		registerConfigureSpeechInstructionsActions();
		registerConfigureSpeechInstructionsActions();
		assert.deepStrictEqual(Array.from(CommandsRegistry.getCommands().keys()), commands);
		assert.deepStrictEqual(MenuRegistry.getMenuItems(MenuId.CommandPalette), menu);
		assert.strictEqual(CommandsRegistry.getCommand(CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID), undefined);
		assert.strictEqual(CommandsRegistry.getCommand(CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID), undefined);
	});
});
