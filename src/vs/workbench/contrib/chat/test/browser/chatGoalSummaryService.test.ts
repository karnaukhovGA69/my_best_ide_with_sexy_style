/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatGoalSummaryService } from '../../browser/chatGoalSummaryService.js';

suite('ChatGoalSummaryService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve models or summarize prompts, including repeated and cancelled calls', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = instantiation.createInstance(ChatGoalSummaryService);
		const prompts = ['', '   ', 'Сохранить документ', 'Сохранить документ', 'Long prompt '.repeat(500)];
		const results = await Promise.all(prompts.map(prompt => service.summarize(prompt, CancellationToken.None)));
		assert.deepStrictEqual(results, prompts.map(() => undefined));
		assert.strictEqual(await service.summarize('Cancelled', CancellationToken.Cancelled), undefined);
	});

	test('does not subscribe to or inspect cancellation state', async () => {
		const token = new Proxy({} as CancellationToken, { get() { throw new Error('Summarization must not start'); } });
		assert.strictEqual(await new ChatGoalSummaryService().summarize('Request', token), undefined);
	});
});
