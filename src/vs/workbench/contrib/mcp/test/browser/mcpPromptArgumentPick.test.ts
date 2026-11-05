/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { McpPromptArgumentPick } from '../../browser/mcpPromptArgumentPick.js';
import { IMcpPrompt } from '../../common/mcpTypes.js';

suite('McpPromptArgumentPick - implementation removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('cancels without resolving services or accessing prompt data', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const prompt = new Proxy(upcastPartial<IMcpPrompt>({}), {
			get() { throw new Error('Unexpected prompt access'); }
		});
		const picker = store.add(instantiation.createInstance(McpPromptArgumentPick, prompt));
		assert.strictEqual(await picker.createArgs(), undefined);
	});

	test('empty argument list follows the caller cancellation branch instead of resolving the prompt', async () => {
		let resolved = false;
		const prompt = upcastPartial<IMcpPrompt>({
			arguments: [],
			async resolve() { resolved = true; return []; },
		});
		const picker = store.add(new McpPromptArgumentPick(prompt));
		const args = await picker.createArgs();
		if (args) {
			await prompt.resolve(args, CancellationToken.None);
		}
		assert.deepStrictEqual({ args, resolved }, { args: undefined, resolved: false });
	});

	test('repeated calls and disposal do not subscribe to cancellation or restart work', async () => {
		const picker = store.add(new McpPromptArgumentPick(upcastPartial<IMcpPrompt>({})));
		const token = new Proxy(upcastPartial<CancellationToken>({}), {
			get() { throw new Error('Unexpected cancellation token access'); }
		});
		const first = await picker.createArgs(token);
		const cancelled = await picker.createArgs(CancellationToken.Cancelled);
		picker.dispose();
		picker.dispose();
		const disposed = await picker.createArgs(token);
		assert.deepStrictEqual({ first, cancelled, disposed }, { first: undefined, cancelled: undefined, disposed: undefined });
	});
});
