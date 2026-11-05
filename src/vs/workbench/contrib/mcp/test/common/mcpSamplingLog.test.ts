/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { InMemoryStorageService, IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { McpSamplingLog } from '../../common/mcpSamplingLog.js';
import { IMcpServer } from '../../common/mcpTypes.js';
import { MCP } from '../../common/modelContextProtocol.js';

suite('MCP - Sampling Log', () => {
	const ds = ensureNoDisposablesAreLeakedInTestSuite();
	const request: MCP.SamplingMessage[] = [{ role: 'user', content: { type: 'text', text: 'test request' } }];
	const server = (scope: StorageScope | undefined = StorageScope.WORKSPACE): IMcpServer => ({
		definition: { id: 'testServer' },
		readDefinitions: () => ({ get: () => ({ collection: scope === undefined ? undefined : { scope } }) }),
	} as IMcpServer);

	function assertEmpty(log: McpSamplingLog, target: IMcpServer): void {
		assert.deepStrictEqual({ has: log.has(target), data: log.get(target), text: log.getAsText(target) }, {
			has: false, data: undefined, text: '',
		});
	}

	test('constructs through strict DI without storage', async () => {
		const insta = ds.add(new InstantiationService(new ServiceCollection(), true));
		const log = ds.add(insta.createInstance(McpSamplingLog));
		await log.add(server(), request, 'test response', 'test model');
		assertEmpty(log, server());
	});

	test('never reads, writes or subscribes to storage', async () => {
		const storage = new Proxy({} as IStorageService, {
			get: (_target, key) => { throw new Error(`Unexpected storage access: ${String(key)}`); },
		});
		const insta = ds.add(new InstantiationService(new ServiceCollection([IStorageService, storage]), true));
		const log = ds.add(insta.createInstance(McpSamplingLog));
		for (const scope of [StorageScope.APPLICATION, StorageScope.APPLICATION_SHARED, StorageScope.PROFILE, StorageScope.WORKSPACE]) {
			const target = server(scope);
			assertEmpty(log, target);
			await log.add(target, request, 'test response', 'test model');
			assertEmpty(log, target);
		}
		log.dispose();
	});

	test('ignores server and request payloads, including after disposal', async () => {
		const target = new Proxy({} as IMcpServer, {
			get: () => { throw new Error('Unexpected server access'); },
		});
		const payload = new Proxy<MCP.SamplingMessage[]>([], {
			get: () => { throw new Error('Unexpected request access'); },
		});
		const insta = ds.add(new InstantiationService(new ServiceCollection(), true));
		const log = ds.add(insta.createInstance(McpSamplingLog));
		await log.add(target, payload, 'test response', 'test model');
		assertEmpty(log, target);
		log.dispose();
		await log.add(target, payload, 'test response', 'test model');
		assertEmpty(log, target);
	});

	test('leaves existing records untouched and ordinary storage usable', async () => {
		const legacy = JSON.stringify([['testServer', {
			head: 19631, bins: [1, 0, 0, 0, 0, 0, 0],
			lastReqs: [{ request, response: 'old test response', at: 1696118400000, model: 'test model' }],
		}]]);
		for (const scope of [StorageScope.APPLICATION, StorageScope.APPLICATION_SHARED, StorageScope.PROFILE, StorageScope.WORKSPACE]) {
			for (const original of [undefined, legacy, 'invalid legacy JSON']) {
				const storage = ds.add(new InMemoryStorageService());
				if (original !== undefined) {
					storage.store('mcp.sampling.logs', original, scope, StorageTarget.MACHINE);
				}
				const insta = ds.add(new InstantiationService(new ServiceCollection([IStorageService, storage]), true));
				const log = ds.add(insta.createInstance(McpSamplingLog));
				const target = server(scope);
				assertEmpty(log, target);
				await Promise.all([
					log.add(target, request, 'test response', 'test model'),
					log.add(target, request, 'another test response', 'test model'),
				]);
				assertEmpty(log, target);
				log.dispose();
				storage.store('test.ordinaryState', 'saved', scope, StorageTarget.USER);
				await storage.flush();
				assert.deepStrictEqual({
					log: storage.get('mcp.sampling.logs', scope),
					ordinary: storage.get('test.ordinaryState', scope),
				}, { log: original, ordinary: 'saved' });
			}
		}
	});
});
