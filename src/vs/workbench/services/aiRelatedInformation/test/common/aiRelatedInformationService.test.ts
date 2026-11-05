/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { AiRelatedInformationService } from '../../common/aiRelatedInformationService.js';
import { RelatedInformationType } from '../../common/aiRelatedInformation.js';

suite('Disabled AI related information', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): AiRelatedInformationService {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		return instantiation.createInstance(AiRelatedInformationService);
	}

	test('needs no logging or other services', () => {
		assert.strictEqual(createService().isEnabled(), false);
	});

	test('never invokes providers for commands or settings', async () => {
		const service = createService();
		let calls = 0;
		for (const type of [RelatedInformationType.CommandInformation, RelatedInformationType.SettingInformation]) {
			const registration = store.add(service.registerAiRelatedInformationProvider(type, { provideAiRelatedInformation: async () => { calls++; return []; } }));
			assert.strictEqual(service.isEnabled(), false);
			await assert.rejects(service.getRelatedInformation('query', [type], CancellationToken.None), /unavailable/);
			registration.dispose();
			registration.dispose();
		}
		assert.strictEqual(calls, 0);
	});

	test('does not inspect cancellation state or install a listener', async () => {
		const service = createService();
		const token = upcastPartial<CancellationToken>(new Proxy({}, { get: () => { throw new Error('Must not inspect token'); } }));
		await assert.rejects(service.getRelatedInformation('query', [], token), /unavailable/);
		await assert.rejects(service.getRelatedInformation('query', [], CancellationToken.Cancelled), /unavailable/);
	});
});
