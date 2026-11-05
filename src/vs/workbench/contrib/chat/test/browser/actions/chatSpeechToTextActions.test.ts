/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ICodeEditor } from '../../../../../../editor/browser/editorBrowser.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IContext } from '../../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry } from '../../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ChatSpeechToTextConfigured, ChatSpeechToTextConnectingAction, ChatSpeechToTextPreparing, ChatSpeechToTextPreparingAction, getDictationShortcutOperation, IDictationShortcutContext, registerChatSpeechToTextActions, runDictationShortcut, ToggleChatSpeechToTextAction } from '../../../browser/actions/chatSpeechToTextActions.js';
import { ChatSpeechToTextState } from '../../../browser/speechToText/chatSpeechToTextService.js';

suite('Chat speech to text actions unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('resolves the dictation toggle operation', () => {
		assert.deepStrictEqual([
			getDictationShortcutOperation(false, ChatSpeechToTextState.Idle, false),
			getDictationShortcutOperation(true, ChatSpeechToTextState.Recording, false),
			getDictationShortcutOperation(true, ChatSpeechToTextState.Recording, true),
			getDictationShortcutOperation(false, ChatSpeechToTextState.Transcribing, false),
		], [
			'start',
			'stop',
			'cancel',
			undefined,
		]);
	});

	test('registration adds no commands, menus or keybindings', () => {
		const commands = Array.from(CommandsRegistry.getCommands().keys());
		const menu = MenuRegistry.getMenuItems(MenuId.ChatExecute);
		const palette = MenuRegistry.getMenuItems(MenuId.CommandPalette);
		const keybindings = KeybindingsRegistry.getDefaultKeybindings();
		const registration = store.add(registerChatSpeechToTextActions());
		assert.strictEqual(registration.isDisposed, false);
		assert.deepStrictEqual(Array.from(CommandsRegistry.getCommands().keys()), commands);
		assert.deepStrictEqual(MenuRegistry.getMenuItems(MenuId.ChatExecute), menu);
		assert.deepStrictEqual(MenuRegistry.getMenuItems(MenuId.CommandPalette), palette);
		assert.deepStrictEqual(KeybindingsRegistry.getDefaultKeybindings(), keybindings);
		registration.dispose();
	});

	test('exported actions have no menus or shortcuts and cannot be enabled by restored context', async () => {
		const context = new Proxy({} as IContext, { get: () => { throw new Error('Context must not be read'); } });
		const accessor = new Proxy({} as ServicesAccessor, { get: () => { throw new Error('Services must not be accessed'); } });
		assert.strictEqual(ChatSpeechToTextConfigured.evaluate(context), false);
		assert.strictEqual(ChatSpeechToTextPreparing.evaluate(context), false);
		for (const action of [new ToggleChatSpeechToTextAction(), new ChatSpeechToTextPreparingAction(), new ChatSpeechToTextConnectingAction()]) {
			assert.strictEqual(action.desc.precondition?.evaluate(context), false);
			assert.strictEqual(action.desc.f1, false);
			assert.strictEqual(action.desc.menu, undefined);
			assert.strictEqual(action.desc.keybinding, undefined);
			await action.run(accessor);
		}
	});

	test('shortcut never accesses the editor, services, key hold mode or supplied start callback', async () => {
		const unreadable = { get: () => { throw new Error('Input must not be read'); } };
		const context = new Proxy({} as IDictationShortcutContext, unreadable);
		const editor = new Proxy({} as ICodeEditor, unreadable);
		await runDictationShortcut(context, 'dictation.start', editor, async () => { throw new Error('Dictation must not start'); });
		await runDictationShortcut(context, 'dictation.start', editor);
	});
});
