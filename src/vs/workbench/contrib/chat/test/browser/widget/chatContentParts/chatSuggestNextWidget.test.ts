/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatSuggestNextWidget } from '../../../../browser/widget/chatContentParts/chatSuggestNextWidget.js';
import { ChatWidget } from '../../../../browser/widget/chatWidget.js';
import { IChatMode } from '../../../../common/chatModes.js';

suite('ChatSuggestNextWidget', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not read handoffs or expose continuation controls', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const widget = store.add(instantiation.createInstance(ChatSuggestNextWidget));
		const mode = new Proxy({} as IChatMode, { get() { throw new Error('Handoffs must not be read'); } });
		let events = 0;
		store.add(widget.onDidChangeHeight(() => events++));
		store.add(widget.onDidSelectPrompt(() => events++));
		widget.render(mode);
		widget.hide();
		widget.render(mode);
		assert.strictEqual(widget.domNode.style.display, 'none');
		assert.strictEqual(widget.domNode.childElementCount, 0);
		assert.strictEqual(widget.height, 0);
		assert.strictEqual(widget.getCurrentMode(), undefined);
		assert.strictEqual(events, 0);
	});

	test('chat rendering does not inspect history or trigger an automatic handoff', () => {
		let hidden = 0;
		const context = new Proxy({ chatSuggestNextWidget: { hide: () => hidden++ } }, {
			get(target, property) {
				if (property === 'chatSuggestNextWidget') {
					return target.chatSuggestNextWidget;
				}
				throw new Error(`Unexpected chat access: ${String(property)}`);
			},
		});
		const prototype = ChatWidget.prototype as unknown as { renderChatSuggestNextWidget(): void };
		prototype.renderChatSuggestNextWidget.call(context);
		assert.strictEqual(hidden, 1);
	});
});
