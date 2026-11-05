/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { EditorExtensionsRegistry } from '../../../../../editor/browser/editorExtensions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IContext } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { EditorDictation, EditorDictationStartAction, EditorDictationStopAction } from '../../browser/dictation/editorDictation.js';

suite('Editor dictation unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('module does not register dictation contribution or commands', () => {
		assert.strictEqual(EditorExtensionsRegistry.getEditorContributions().some(contribution => contribution.id === EditorDictation.ID), false);
		assert.strictEqual(CommandsRegistry.getCommand(EditorDictationStartAction.ID), undefined);
		assert.strictEqual(CommandsRegistry.getCommand(EditorDictationStopAction.ID), undefined);
	});

	test('explicit contribution construction requires no services and leaves editor untouched', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const editor = new Proxy({} as ICodeEditor, { get: () => { throw new Error('Editor must not be read'); } });
		const contribution = store.add(instantiation.createInstance(EditorDictation, editor));
		assert.strictEqual(EditorDictation.get(editor), null);
		for (let i = 0; i < 2; i++) {
			await contribution.start();
			assert.strictEqual(contribution.isInProgress(), false);
			contribution.stop();
			contribution.dispose();
		}
	});

	test('direct actions remain disabled and cannot access speech services or editor', async () => {
		const unreadable = { get: () => { throw new Error('Input must not be read'); } };
		const context = new Proxy({} as IContext, unreadable);
		const accessor = new Proxy({} as ServicesAccessor, unreadable);
		const editor = new Proxy({} as ICodeEditor, unreadable);
		for (const action of [new EditorDictationStartAction(), new EditorDictationStopAction()]) {
			assert.strictEqual(action.desc.precondition?.evaluate(context), false);
			assert.strictEqual(action.desc.menu, undefined);
			assert.strictEqual(action.desc.keybinding, undefined);
			assert.strictEqual(action.desc.f1, false);
			await action.runEditorCommand(accessor, editor);
		}
	});
});
