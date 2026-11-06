/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { PromptUrlHandler } from '../../../browser/promptSyntax/promptUrlHandler.js';

suite('PromptUrlHandler disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register a URL handler or activate services for AI links', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const handler = store.add(instantiation.createInstance(PromptUrlHandler));
		const unreadable = new Proxy({} as URI, { get() { throw new Error('AI URL must not be inspected'); } });
		for (const uri of [
			URI.parse('vscode:chat-prompt/install?url=https://example.test/prompt.md'),
			URI.parse('vscode:chat-instructions/install?url=https://example.test/instructions.md'),
			URI.parse('vscode:chat-agent/install?url=https://example.test/agent.md'),
			URI.parse('vscode:chat-mode/install?url=https://example.test/mode.md'),
			URI.parse('vscode://unrelated/open'),
			unreadable,
		]) {
			assert.strictEqual(await handler.handleURL(uri), false);
		}
	});
});
