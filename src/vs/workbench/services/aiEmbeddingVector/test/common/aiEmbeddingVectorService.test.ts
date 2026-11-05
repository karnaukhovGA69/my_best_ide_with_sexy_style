/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { AiEmbeddingVectorService } from '../../common/aiEmbeddingVectorService.js';

suite('Disabled AI embedding vectors', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): AiEmbeddingVectorService {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		return instantiation.createInstance(AiEmbeddingVectorService);
	}

	test('needs no logging or other services', () => {
		assert.strictEqual(createService().isEnabled(), false);
	});

	test('never invokes a registered provider for either overload', async () => {
		const service = createService();
		let calls = 0;
		const registration = store.add(service.registerAiEmbeddingVectorProvider('fixture-model', { provideAiEmbeddingVector: async () => { calls++; return [[1]]; } }));
		assert.strictEqual(service.isEnabled(), false);
		await assert.rejects(service.getEmbeddingVector('query', CancellationToken.None), /unavailable/);
		await assert.rejects(service.getEmbeddingVector(['query'], CancellationToken.None), /unavailable/);
		assert.strictEqual(calls, 0);
		registration.dispose();
		registration.dispose();
	});

	test('does not inspect cancellation state or install a listener', async () => {
		const service = createService();
		const token = upcastPartial<CancellationToken>(new Proxy({}, { get: () => { throw new Error('Must not inspect token'); } }));
		await assert.rejects(service.getEmbeddingVector([], token), /unavailable/);
		await assert.rejects(service.getEmbeddingVector('query', CancellationToken.Cancelled), /unavailable/);
	});
});
