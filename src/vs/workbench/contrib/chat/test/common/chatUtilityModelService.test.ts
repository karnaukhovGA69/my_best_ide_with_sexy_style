/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatUtilityModelService, IChatUtilityModelRequest } from '../../common/chatUtilityModelService.js';

suite('ChatUtilityModelService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve providers or inspect requests and cancellation state', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(ChatUtilityModelService));
		const unreadable = { get() { throw new Error('Utility AI must not inspect requests'); } };
		assert.strictEqual(await service.sendRequest(new Proxy({} as IChatUtilityModelRequest, unreadable), new Proxy({} as CancellationToken, unreadable)), undefined);
	});

	test('settles foreground, background, repeated and disposed calls without work', async () => {
		const service = store.add(new ChatUtilityModelService());
		const request: IChatUtilityModelRequest = {
			purpose: 'thinkingTitle', model: 'test-model', messages: [], key: 'shared',
			isRelevant: () => { throw new Error('Relevance must not be evaluated'); },
		};
		const results = await Promise.all([
			service.sendRequest(request, CancellationToken.None),
			service.sendRequest({ ...request, background: true }, CancellationToken.None),
			service.sendRequest(request, CancellationToken.Cancelled),
		]);
		assert.deepStrictEqual(results, [undefined, undefined, undefined]);
		service.dispose();
		assert.strictEqual(await service.sendRequest(request, CancellationToken.None), undefined);
	});
});
