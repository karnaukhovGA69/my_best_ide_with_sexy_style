/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { InMemoryStorageService, IStorageService, StorageScope, StorageTarget } from '../../../../../../platform/storage/common/storage.js';
import { ChatTransferContribution } from '../../../browser/actions/chatTransfer.js';
import { ChatTransferService } from '../../../common/model/chatTransferService.js';

suite('Chat transfer automatic trust disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not activate a transfer service on startup', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatTransferContribution));
	});

	test('does not activate trust or file services and preserves existing transfer data', async () => {
		const storage = store.add(new InMemoryStorageService());
		const key = 'chat.transferedWorkspaces';
		const existing = ['file:///previous-workspace'];
		storage.store(key, existing, StorageScope.PROFILE, StorageTarget.MACHINE);
		const instantiation = store.add(new InstantiationService(new ServiceCollection([IStorageService, storage]), true));
		const service = instantiation.createInstance(ChatTransferService);
		service.addWorkspaceToTransferred(URI.file('/new-workspace'));
		service.addWorkspaceToTransferred(new Proxy({} as URI, { get() { throw new Error('Transfer URI must not be inspected'); } }));
		await service.checkAndSetTransferredWorkspaceTrust();
		assert.deepStrictEqual(storage.getObject(key, StorageScope.PROFILE), existing);
	});
});
