/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IMcpGalleryManifest, McpGalleryManifestStatus } from '../../../../../platform/mcp/common/mcpGalleryManifest.js';
import { IQueryOptions } from '../../../../../platform/mcp/common/mcpManagement.js';
import { IWorkbenchLocalMcpServer } from '../../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { MCPContextsInitialisation, McpWorkbenchService } from '../../browser/mcpWorkbenchService.js';
import { HasInstalledMcpServersContext, IWorkbenchMcpServer, McpServersGalleryStatusContext } from '../../common/mcpTypes.js';

suite('McpWorkbenchService - implementation removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disabled = 'MCP management is disabled in Myself IDE.';
	const server = upcastPartial<IWorkbenchMcpServer>({ get name(): never { throw new Error('Server read'); } });
	async function rejection(promise: Promise<unknown>): Promise<string> {
		return promise.then(() => 'Unexpected success', error => error instanceof Error ? error.message : String(error));
	}

	test('eager service initializes without infrastructure and readiness completes', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(McpWorkbenchService));
		await service.whenInitialLocalMcpServersLoaded;
		service.dispose();
		service.dispose();
	});

	test('inventory is empty, independent between reads and emits no changes', async () => {
		const service = store.add(new McpWorkbenchService());
		const events: string[] = [];
		store.add(service.onChange(() => events.push('change')));
		store.add(service.onReset(() => events.push('reset')));
		const previous = await service.queryLocal();
		previous.push(server);
		const enabled = service.getEnabledLocalMcpServers();
		enabled.push(upcastPartial<IWorkbenchLocalMcpServer>({}));
		assert.deepStrictEqual({ local: service.local, query: await service.queryLocal(), enabled: service.getEnabledLocalMcpServers(), events }, {
			local: [], query: [], enabled: [], events: [],
		});
	});

	test('gallery returns exhausted independent pages without reading options or manifest', async () => {
		const service = store.add(new McpWorkbenchService());
		const options = upcastPartial<IQueryOptions>({ get text(): never { throw new Error('Query read'); } });
		const manifest = upcastPartial<IMcpGalleryManifest>({ get resources(): never { throw new Error('Manifest read'); } });
		const pager = await service.queryGallery(options, CancellationToken.Cancelled, manifest);
		const first = { items: [...pager.firstPage.items], hasMore: pager.firstPage.hasMore };
		pager.firstPage.items.push(server);
		const next = await pager.getNextPage(CancellationToken.Cancelled);
		assert.deepStrictEqual({ first, next, lookup: await service.getMcpServerFromGallery('test-server', manifest) }, {
			first: { items: [], hasMore: false }, next: { items: [], hasMore: false }, lookup: undefined,
		});
	});

	test('install eligibility reports unavailability without inspecting server data', () => {
		const service = store.add(new McpWorkbenchService());
		assert.strictEqual(service.canInstall(server).value, disabled);
	});

	for (const operation of ['install', 'uninstall', 'open', 'openSearch'] as const) {
		test(`${operation} refuses work without infrastructure`, async () => {
			const service = store.add(new McpWorkbenchService());
			const result = operation === 'openSearch' ? service.openSearch('test') : service[operation](server);
			assert.strictEqual(await rejection(result), disabled);
		});
	}

	test('configuration lookups retain synchronous and asynchronous contracts without reading settings', async () => {
		const service = store.add(new McpWorkbenchService());
		const local = upcastPartial<IWorkbenchLocalMcpServer>({ get scope(): never { throw new Error('Scope read'); } });
		const uri = URI.from({ scheme: 'inmemory', path: '/mcp.json' });
		const asyncPath = service.getMcpConfigPath(uri);
		assert.deepStrictEqual({
			local: service.getMcpConfigPath(local), promise: asyncPath instanceof Promise, uri: await asyncPath,
			editable: await service.resolveEditableMcpServerConfiguration(uri, 'test-server'),
			handled: await service.handleURL(URI.parse('test://mcp/install?test')),
		}, { local: undefined, promise: true, uri: undefined, editable: undefined, handled: false });
	});

	test('context initialization needs only context keys and preserves unrelated state', () => {
		const context = store.add(new MockContextKeyService());
		context.createKey('test.ordinary', 'keep');
		McpServersGalleryStatusContext.bindTo(context).set('available');
		HasInstalledMcpServersContext.bindTo(context).set(true);
		const instantiation = store.add(new InstantiationService(new ServiceCollection([IContextKeyService, context]), true));
		const contribution = store.add(instantiation.createInstance(MCPContextsInitialisation));
		contribution.dispose();
		assert.deepStrictEqual({
			installed: context.getContextKeyValue(HasInstalledMcpServersContext.key),
			gallery: context.getContextKeyValue(McpServersGalleryStatusContext.key),
			ordinary: context.getContextKeyValue('test.ordinary'),
		}, { installed: false, gallery: McpGalleryManifestStatus.Unavailable, ordinary: 'keep' });
	});
});
