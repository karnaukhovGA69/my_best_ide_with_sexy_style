/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { InMemoryStorageService, IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { ChatThinkingTitleService, IChatThinkingTitleRequest } from '../../common/chatThinkingTitleService.js';
import { chatSessionResourceToId } from '../../common/model/chatUri.js';

suite('ChatThinkingTitleService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const cacheKey = 'chat.thinkingTitleCache';
	const request: IChatThinkingTitleRequest = { sessionResource: URI.parse('ahp-chat://test/session/chat'), content: 'Existing reasoning', legacyId: 'old-part' };
	const legacyKey = `${chatSessionResourceToId(request.sessionResource)}:${request.legacyId}`;

	teardown(() => sinon.restore());

	function createService(storage: InMemoryStorageService): ChatThinkingTitleService {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[IStorageService, storage], [ILogService, new NullLogService()],
		), true));
		return store.add(instantiation.createInstance(ChatThinkingTitleService));
	}

	test('reuses stored history titles without model services or storage writes', async () => {
		const storage = store.add(new InMemoryStorageService());
		const persisted = JSON.stringify({ [legacyKey]: { title: 'Saved title', storedAt: Date.now() } });
		storage.store(cacheKey, persisted, StorageScope.PROFILE, StorageTarget.MACHINE);
		const writes = sinon.spy(storage, 'store');
		const service = createService(storage);
		assert.strictEqual(service.getCachedTitle(request), 'Saved title');
		assert.strictEqual(await service.generateTitle(request, () => true, CancellationToken.None), 'Saved title');
		assert.strictEqual(await service.generateTitle({ ...request, legacyId: undefined }, () => true, CancellationToken.None), undefined);
		service.dispose();
		assert.strictEqual(writes.callCount, 0);
		assert.strictEqual(storage.get(cacheKey, StorageScope.PROFILE), persisted);
	});

	test('honors external cache updates without rewriting stored history', () => {
		const storage = store.add(new InMemoryStorageService());
		const service = createService(storage);
		assert.strictEqual(service.getCachedTitle(request), undefined);
		const persisted = JSON.stringify({ [legacyKey]: { title: 'External title', storedAt: Date.now() } });
		storage.storeAll([{ key: cacheKey, value: persisted, scope: StorageScope.PROFILE, target: StorageTarget.MACHINE }], true);
		assert.strictEqual(service.getCachedTitle(request), 'External title');
		assert.strictEqual(service.getCachedTitle({ ...request, isValidTitle: () => false }), undefined);
		assert.strictEqual(storage.get(cacheKey, StorageScope.PROFILE), persisted);
	});

	test('ignores expired or malformed entries without deleting them', () => {
		for (const entry of [{ title: 'Expired', storedAt: 0 }, { title: 42, storedAt: Date.now() }]) {
			const storage = store.add(new InMemoryStorageService());
			const persisted = JSON.stringify({ [legacyKey]: entry });
			storage.store(cacheKey, persisted, StorageScope.PROFILE, StorageTarget.MACHINE);
			const service = createService(storage);
			assert.strictEqual(service.getCachedTitle(request), undefined);
			service.dispose();
			assert.strictEqual(storage.get(cacheKey, StorageScope.PROFILE), persisted);
		}
	});

	test('does no request or storage work for irrelevant, cancelled, or disposed calls', async () => {
		const storage = store.add(new InMemoryStorageService());
		const reads = sinon.spy(storage, 'getObject');
		const service = createService(storage);
		const unreadable = new Proxy({} as IChatThinkingTitleRequest, { get() { throw new Error('Request must not be read'); } });
		assert.strictEqual(await service.generateTitle(unreadable, () => false, CancellationToken.None), undefined);
		assert.strictEqual(await service.generateTitle(unreadable, () => true, CancellationToken.Cancelled), undefined);
		service.dispose();
		assert.strictEqual(await service.generateTitle(unreadable, () => true, CancellationToken.None), undefined);
		assert.strictEqual(reads.callCount, 0);
	});
});
