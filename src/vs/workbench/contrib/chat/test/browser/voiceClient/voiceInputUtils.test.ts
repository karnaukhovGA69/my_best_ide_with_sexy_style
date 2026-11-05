/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../../base/test/common/mock.js';
import { IChatWidget } from '../../../browser/chat.js';
import { acceptVoiceInput, combineVoiceInput } from '../../../browser/voiceClient/voiceInputUtils.js';

suite('combineVoiceInput', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps typed input and appends the transcript', () => {
		assert.deepStrictEqual(
			[
				combineVoiceInput('', 'hello world'),
				combineVoiceInput('please', 'run the tests'),
				combineVoiceInput('please ', 'run the tests'),
				combineVoiceInput('please\n', 'run the tests'),
				combineVoiceInput('draft', ''),
			],
			[
				'hello world',
				'please run the tests',
				'please run the tests',
				'please\nrun the tests',
				'draft',
			]
		);
	});

});

suite('Voice input submission unavailable', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('rejects all voice input without reading widget or model state', async () => {
		const widget = new Proxy({} as IChatWidget, { get: () => { throw new Error('Widget must not be read'); } });
		for (const voiceMode of [true, false]) {
			for (const text of ['', 'spoken request']) {
				assert.strictEqual(await acceptVoiceInput(widget, text, voiceMode), false);
				assert.strictEqual(await acceptVoiceInput(undefined, text, voiceMode), false);
			}
		}
	});

	test('preserves typed drafts without edits, submission or queueing', async () => {
		let draft = 'Existing typed draft';
		let submissions = 0;
		let reads = 0;
		const widget = upcastPartial<IChatWidget>({
			input: upcastPartial<IChatWidget['input']>({ setValue: text => { draft = text; } }),
			getInput: () => { reads++; return draft; },
			acceptInput: async () => { submissions++; return undefined; },
		});
		assert.strictEqual(await acceptVoiceInput(widget, 'replacement', true), false);
		assert.deepStrictEqual({ draft, reads, submissions }, { draft: 'Existing typed draft', reads: 0, submissions: 0 });
	});
});
