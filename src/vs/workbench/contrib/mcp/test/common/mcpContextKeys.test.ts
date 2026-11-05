/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { derived, observableValue } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { McpContextKeys, McpContextKeysController } from '../../common/mcpContextKeys.js';
import { IMcpServer, IMcpService, IMcpTool, LazyCollectionState, McpConnectionState, McpServerCacheState } from '../../common/mcpTypes.js';

suite('Workbench - MCP - Empty UI context', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const empty = { servers: 0, tools: 0, unknown: false, errors: false };
	function snapshot(context: IContextKeyService) {
		return {
			servers: context.getContextKeyValue(McpContextKeys.serverCount.key),
			tools: context.getContextKeyValue(McpContextKeys.toolsCount.key),
			unknown: context.getContextKeyValue(McpContextKeys.hasUnknownTools.key),
			errors: context.getContextKeyValue(McpContextKeys.hasServersWithErrors.key),
		};
	}

	test('initializes empty state without MCP services and preserves unrelated keys', () => {
		const context = store.add(new MockContextKeyService());
		context.createKey('test.ordinary', 'keep');
		McpContextKeys.serverCount.bindTo(context).set(12);
		McpContextKeys.toolsCount.bindTo(context).set(34);
		McpContextKeys.hasUnknownTools.bindTo(context).set(true);
		McpContextKeys.hasServersWithErrors.bindTo(context).set(true);
		const instantiation = store.add(new InstantiationService(new ServiceCollection([IContextKeyService, context]), true));
		const contribution = store.add(instantiation.createInstance(McpContextKeysController));
		const active = snapshot(context);
		contribution.dispose();
		contribution.dispose();
		assert.deepStrictEqual({ active, disposed: snapshot(context), ordinary: context.getContextKeyValue('test.ordinary') }, {
			active: empty, disposed: empty, ordinary: 'keep',
		});
	});

	test('does not observe server inventory, tools, errors or discovery state', () => {
		const calls: string[] = [];
		const context = store.add(new MockContextKeyService());
		const tools = observableValue<readonly IMcpTool[]>('tools', [upcastPartial<IMcpTool>({ id: 'test-tool' })]);
		const connectionState = observableValue<McpConnectionState>('connection', { state: McpConnectionState.Kind.Error, message: 'Test error' });
		const cacheState = observableValue('cache', McpServerCacheState.Unknown);
		const server = upcastPartial<IMcpServer>({ tools, connectionState, cacheState });
		const servers = observableValue<readonly IMcpServer[]>('servers', [server]);
		const lazy = observableValue('discovery', { state: LazyCollectionState.HasUnknown, collections: [] });
		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[IContextKeyService, context],
			[IMcpService, upcastPartial<IMcpService>({
				servers: derived(reader => { calls.push('read servers'); return servers.read(reader); }),
				lazyCollectionState: derived(reader => { calls.push('read discovery'); return lazy.read(reader); }),
			})],
		), true));
		const contribution = store.add(instantiation.createInstance(McpContextKeysController));
		const initial = snapshot(context);
		tools.set([], undefined);
		connectionState.set({ state: McpConnectionState.Kind.Running }, undefined);
		cacheState.set(McpServerCacheState.Live, undefined);
		lazy.set({ state: LazyCollectionState.AllKnown, collections: [] }, undefined);
		servers.set([], undefined);
		servers.set([server], undefined);
		const updated = snapshot(context);
		contribution.dispose();
		servers.set([], undefined);
		assert.deepStrictEqual({ initial, updated, disposed: snapshot(context), calls }, {
			initial: empty, updated: empty, disposed: empty, calls: [],
		});
	});
});
