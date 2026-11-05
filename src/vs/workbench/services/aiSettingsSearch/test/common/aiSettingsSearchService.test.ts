/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { AiSettingsSearchService } from '../../common/aiSettingsSearchService.js';
import { AiSettingsSearchResult, AiSettingsSearchResultKind, IAiSettingsSearchProvider } from '../../common/aiSettingsSearch.js';

suite('Disabled AI settings search', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): AiSettingsSearchService {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		return store.add(instantiation.createInstance(AiSettingsSearchService));
	}

	test('registration never enables AI search or notifies the settings editor', () => {
		const service = createService();
		let events = 0;
		store.add(service.onProviderRegistered(() => { events++; }));
		const registration = store.add(service.registerSettingsSearchProvider({ searchSettings: () => assert.fail('Must not invoke provider') }));
		assert.strictEqual(service.isEnabled(), false);
		assert.strictEqual(events, 0);
		registration.dispose();
		registration.dispose();
	});

	test('returns no results immediately and ignores unsolicited provider responses', async () => {
		const service = createService();
		let calls = 0;
		store.add(service.registerSettingsSearchProvider({ searchSettings: () => { calls++; } }));
		assert.strictEqual(service.isEnabled(), false);
		for (const token of [CancellationToken.None, CancellationToken.Cancelled]) {
			service.startSearch('editor font', token);
			for (const kind of [AiSettingsSearchResultKind.EMBEDDED, AiSettingsSearchResultKind.LLM_RANKED, AiSettingsSearchResultKind.CANCELED]) {
				service.handleSearchResult({ query: 'editor font', kind, settings: ['editor.fontSize'] });
			}
			assert.strictEqual(await service.getEmbeddingsResults('editor font', token), null);
			assert.strictEqual(await service.getLLMRankedResults('editor font', token), null);
		}
		assert.strictEqual(calls, 0);
	});

	test('does not inspect provider, result or cancellation payloads', async () => {
		const service = createService();
		const forbidden = () => { throw new Error('Must not inspect AI payload'); };
		const payload = new Proxy({}, { get: forbidden, ownKeys: forbidden });
		store.add(service.registerSettingsSearchProvider(upcastPartial<IAiSettingsSearchProvider>(payload)));
		assert.strictEqual(service.isEnabled(), false);
		service.handleSearchResult(upcastPartial<AiSettingsSearchResult>(payload));
		const token = upcastPartial<CancellationToken>(payload);
		service.startSearch('query', token);
		assert.strictEqual(await service.getEmbeddingsResults('query', token), null);
		assert.strictEqual(await service.getLLMRankedResults('query', token), null);
	});
});
