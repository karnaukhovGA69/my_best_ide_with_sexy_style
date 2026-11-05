/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { autorun } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { IWorkspaceFolderData } from '../../../../../platform/workspace/common/workspace.js';
import { IResolvedValue } from '../../../../services/configurationResolver/common/configurationResolverExpression.js';
import { McpRegistry } from '../../common/mcpRegistry.js';
import { IMcpHostDelegate, IMcpResolveConnectionOptions } from '../../common/mcpRegistryTypes.js';
import { LazyCollectionState, McpCollectionDefinition, McpDefinitionReference, McpServerDefinition } from '../../common/mcpTypes.js';

suite('Workbench - MCP - registry runtime removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function unreadable<T extends object>(): T {
		return new Proxy(upcastPartial<T>({}), { get() { throw new Error('Removed registry dependency accessed'); } });
	}

	test('DI constructs without configuration, storage, dialogs, trust or host services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const registry = store.add(instantiation.createInstance(McpRegistry));
		assert.deepStrictEqual(registry.collections.get(), []);
		assert.deepStrictEqual(registry.delegates.get(), []);
	});

	test('registration never reads collection definitions or host delegates and cannot populate inventories', () => {
		const registry = store.add(new McpRegistry());
		const seen: number[] = [];
		store.add(autorun(reader => seen.push(registry.collections.read(reader).length + registry.delegates.read(reader).length)));
		const collection = registry.registerCollection(unreadable<McpCollectionDefinition>());
		const delegate = registry.registerDelegate(unreadable<IMcpHostDelegate>());
		collection.dispose();
		delegate.dispose();
		collection.dispose();
		assert.deepStrictEqual({ seen, frozenCollections: Object.isFrozen(registry.collections.get()), frozenDelegates: Object.isFrozen(registry.delegates.get()) }, { seen: [0], frozenCollections: true, frozenDelegates: true });
	});

	test('definition lookup does not read references and returns independent empty results', () => {
		const registry = store.add(new McpRegistry());
		const lookup = () => registry.getServerDefinition(unreadable<McpDefinitionReference>(), unreadable<McpDefinitionReference>()).get();
		const previous = lookup();
		previous.server = unreadable<McpServerDefinition>();
		previous.collection = unreadable<McpCollectionDefinition>();
		assert.deepStrictEqual(lookup(), { server: undefined, collection: undefined });
	});

	test('discovery finishes immediately without activation and cannot retain mutated results', async () => {
		const registry = store.add(new McpRegistry());
		const discovered = await registry.discoverCollections();
		discovered.push(unreadable<McpCollectionDefinition>());
		const lazy = registry.lazyCollectionState.get();
		lazy.state = LazyCollectionState.HasUnknown;
		lazy.collections.push(unreadable<McpCollectionDefinition>());
		assert.deepStrictEqual(await registry.discoverCollections(), []);
		assert.deepStrictEqual(registry.lazyCollectionState.get(), { state: LazyCollectionState.AllKnown, collections: [] });
	});

	test('connection resolution never reads options, prompts for trust or invokes a delegate', async () => {
		const registry = store.add(new McpRegistry());
		assert.strictEqual(await registry.resolveConnection(unreadable<IMcpResolveConnectionOptions>()), undefined);
	});

	test('saved inputs stay empty and mutations explicitly reject without storage or input events', async () => {
		const registry = store.add(new McpRegistry());
		let events = 0;
		store.add(registry.onDidChangeInputs(() => events++));
		for (const scope of [StorageScope.APPLICATION, StorageScope.PROFILE, StorageScope.WORKSPACE]) {
			const previous = await registry.getSavedInputs(scope);
			previous.stale = unreadable<IResolvedValue>();
			assert.deepStrictEqual(await registry.getSavedInputs(scope), {});
			for (const operation of [
				() => registry.clearSavedInputs(scope),
				() => registry.clearSavedInputs(scope, 'fixture'),
				() => registry.editSavedInput('fixture', unreadable<IWorkspaceFolderData>(), 'mcp', ConfigurationTarget.USER),
				() => registry.setSavedInput('fixture', ConfigurationTarget.WORKSPACE, 'fixture-value'),
			]) {
				const message = await operation().then(() => 'unexpected success', error => error.message);
				assert.strictEqual(message, 'MCP saved inputs are unavailable in this distribution.');
			}
		}
		assert.strictEqual(events, 0);
	});

	test('late calls after disposal allocate no timers or runtime work', async () => {
		const clock = sinon.useFakeTimers();
		try {
			const registry = store.add(new McpRegistry());
			registry.dispose();
			registry.dispose();
			store.add(registry.registerCollection(unreadable<McpCollectionDefinition>()));
			store.add(registry.registerDelegate(unreadable<IMcpHostDelegate>()));
			assert.deepStrictEqual(await registry.discoverCollections(), []);
			assert.strictEqual(await registry.resolveConnection(unreadable<IMcpResolveConnectionOptions>()), undefined);
			await clock.tickAsync(1000);
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			clock.restore();
		}
	});
});
