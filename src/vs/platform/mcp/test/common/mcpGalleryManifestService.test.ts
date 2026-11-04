/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { raceTimeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IFileService } from '../../../files/common/files.js';
import { InstantiationService } from '../../../instantiation/common/instantiationService.js';
import { NullLogService } from '../../../log/common/log.js';
import { IRequestService } from '../../../request/common/request.js';
import { IMcpGalleryManifest, McpGalleryManifestStatus } from '../../common/mcpGalleryManifest.js';
import { McpGalleryManifestService } from '../../common/mcpGalleryManifestService.js';
import { McpGalleryManifestIPCService } from '../../common/mcpGalleryManifestServiceIpc.js';
import { McpGalleryService } from '../../common/mcpGalleryService.js';

suite('MCP gallery unavailable in Myself IDE', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('manifest resolves without product, configuration or network services', async () => {
		const instantiationService = store.add(new InstantiationService());
		const service = store.add(instantiationService.createInstance(McpGalleryManifestService));
		assert.deepStrictEqual({
			manifest: await service.getMcpGalleryManifest(),
			defaultManifest: await service.getDefaultMcpGalleryManifest(),
			status: service.mcpGalleryManifestStatus,
		}, { manifest: null, defaultManifest: null, status: McpGalleryManifestStatus.Unavailable });
	});

	test('shared and remote manifest reads do not wait for a workbench client', async () => {
		const service = store.add(new McpGalleryManifestIPCService({ registerChannel: () => {} }));
		assert.strictEqual(await raceTimeout(service.getMcpGalleryManifest(), 100), null);
	});

	test('legacy IPC updates cannot enable a gallery or emit change events', async () => {
		const channels = new Map<string, IServerChannel<unknown>>();
		const service = store.add(new McpGalleryManifestIPCService({
			registerChannel: (name, channel) => { channels.set(name, channel); }
		}));
		let events = 0;
		store.add(service.onDidChangeMcpGalleryManifest(() => events++));
		store.add(service.onDidChangeMcpGalleryManifestStatus(() => events++));
		const channel = channels.get('mcpGalleryManifest');
		assert.ok(channel);
		const manifest: IMcpGalleryManifest = { url: 'https://registry.example.test', version: 'v0.1', resources: [] };
		const states = [];
		for (const value of [manifest, null]) {
			await channel.call(undefined, 'setMcpGalleryManifest', [value]);
			states.push({ manifest: await service.getMcpGalleryManifest(), status: service.mcpGalleryManifestStatus });
		}
		assert.deepStrictEqual({ states, events }, {
			states: [
				{ manifest: null, status: McpGalleryManifestStatus.Unavailable },
				{ manifest: null, status: McpGalleryManifestStatus.Unavailable },
			],
			events: 0,
		});
		await assert.rejects(channel.call(undefined, 'unexpected'), /Invalid call/);
	});

	test('existing gallery consumer returns empty queries and makes no requests', async () => {
		let requests = 0;
		const requestService = new class extends mock<IRequestService>() {
			override async request(): Promise<never> {
				requests++;
				throw new Error('Unexpected MCP request');
			}
		};
		const manifestService = store.add(new McpGalleryManifestService());
		const gallery = store.add(new McpGalleryService(requestService, new class extends mock<IFileService>() {}, store.add(new NullLogService()), manifestService));
		const page = await gallery.query();
		await assert.rejects(gallery.queryPage({ pageSize: 20 }, CancellationToken.None), /MCP gallery is not configured/);
		assert.deepStrictEqual({
			enabled: gallery.isEnabled(),
			firstPage: page.firstPage,
			nextPage: await page.getNextPage(CancellationToken.None),
			requests,
		}, { enabled: false, firstPage: { items: [], hasMore: false }, nextPage: { items: [], hasMore: false }, requests: 0 });
	});
});
