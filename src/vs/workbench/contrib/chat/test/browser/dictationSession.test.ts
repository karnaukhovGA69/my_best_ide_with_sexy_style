/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { mainWindow } from '../../../../../base/browser/window.js';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { createTestCodeEditor } from '../../../../../editor/test/browser/testCodeEditor.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IChatSpeechToTextService } from '../../browser/speechToText/chatSpeechToTextService.js';
import { activeDictationEditor, cancelDictation, isDictating, isDictationActiveForEditor, notifyDictationSubmitted, onDidChangeDictationEditor, startDictation, stopDictation, stopDictationForEditor } from '../../browser/speechToText/dictationSession.js';

suite('Dictation sessions unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const unreadable = { get: () => { throw new Error('Input must not be read'); } };

	test('never reads services, editor or window on any surface and schedules no timers', async () => {
		const sandbox = sinon.createSandbox();
		const timers = sandbox.useFakeTimers();
		try {
			const service = new Proxy({} as IChatSpeechToTextService, unreadable);
			const editor = new Proxy({} as ICodeEditor, unreadable);
			const targetWindow = new Proxy({} as Window & typeof globalThis, unreadable);
			const log = new Proxy({} as ILogService, unreadable);
			assert.strictEqual(onDidChangeDictationEditor, Event.None);
			const changed = sandbox.spy();
			store.add(onDidChangeDictationEditor(changed));
			for (const surface of ['chat', 'editor', 'terminal'] as const) {
				await startDictation(service, editor, targetWindow, log, surface);
				assert.strictEqual(isDictating(), false);
				assert.strictEqual(activeDictationEditor(), undefined);
				assert.strictEqual(isDictationActiveForEditor(editor), false);
				notifyDictationSubmitted(editor);
				await stopDictationForEditor(editor);
				cancelDictation();
				await stopDictation();
			}
			await timers.tickAsync(21 * 60 * 1000);
			assert.strictEqual(changed.callCount, 0);
			assert.strictEqual(timers.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('concurrent start, stop, cancel and submit preserve normal edits and selections', async () => {
		const model = store.add(createTextModel('original text'));
		const editor = store.add(createTestCodeEditor(model));
		editor.setPosition({ lineNumber: 1, column: 5 });
		const initialSelection = editor.getSelection();
		const decorations = model.getAllDecorations().map(decoration => decoration.id);
		const service = new Proxy({} as IChatSpeechToTextService, unreadable);
		const log = new Proxy({} as ILogService, unreadable);
		await Promise.all([
			startDictation(service, editor, mainWindow, log),
			startDictation(service, editor, mainWindow, log, 'editor'),
			stopDictationForEditor(editor),
			stopDictation(),
		]);
		cancelDictation();
		notifyDictationSubmitted(editor);
		assert.strictEqual(model.getValue(), 'original text');
		assert.deepStrictEqual(editor.getSelection(), initialSelection);
		assert.deepStrictEqual(model.getAllDecorations().map(decoration => decoration.id), decorations);
		editor.trigger('test', 'type', { text: 'manual' });
		assert.strictEqual(model.getValue(), 'origmanualinal text');
	});
});
