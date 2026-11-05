/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IChatSpeechToTextService } from '../../browser/speechToText/chatSpeechToTextService.js';
import { DictationDownloadRing, getDictationDownloadHoverContent, getDictationDownloadHoverMarkdown, getDictationPreparingLabel } from '../../browser/speechToText/dictationDownloadRing.js';

suite('Dictation progress indicators unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const service = new Proxy({} as IChatSpeechToTextService, { get: () => { throw new Error('Service must not be read'); } });

	test('construction and updates never render SVG or observe progress', () => {
		const container = document.createElement('div');
		container.innerHTML = '<span>Existing control</span>';
		const original = container.outerHTML;
		const ring = store.add(new DictationDownloadRing(container, service));
		for (let i = 0; i < 2; i++) {
			ring.update();
			ring.dispose();
			assert.strictEqual(container.outerHTML, original);
		}
		const unreadableContainer = new Proxy({} as HTMLElement, { get: () => { throw new Error('Container must not be read'); } });
		store.add(new DictationDownloadRing(unreadableContainer, service));
	});

	test('hover and label report unavailable without reading backend or progress', () => {
		const message = 'Dictation is unavailable in Myself IDE.';
		assert.strictEqual(getDictationPreparingLabel(service), message);
		assert.strictEqual(getDictationDownloadHoverMarkdown(service).value, message);
		const content = getDictationDownloadHoverContent(service);
		assert.ok(content && typeof content === 'object' && 'markdownNotSupportedFallback' in content);
		assert.strictEqual(content.markdownNotSupportedFallback, message);
		assert.strictEqual(getDictationDownloadHoverMarkdown(service).isTrusted, false);
	});
});
