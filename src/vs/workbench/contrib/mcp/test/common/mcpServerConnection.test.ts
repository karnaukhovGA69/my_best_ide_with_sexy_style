/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { autorun } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ILogger } from '../../../../../platform/log/common/log.js';
import { McpServerPolicyValues } from '../../../../../platform/mcp/common/allowedMcpServers.js';
import { IMcpHostDelegate } from '../../common/mcpRegistryTypes.js';
import { McpServerConnection } from '../../common/mcpServerConnection.js';
import { McpTaskManager } from '../../common/mcpTaskManager.js';
import { IMcpClientMethods, McpCollectionDefinition, McpConnectionState, McpServerDefinition, McpServerLaunch } from '../../common/mcpTypes.js';

suite('Workbench - MCP - server connection removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const unavailable = { state: McpConnectionState.Kind.Error, message: 'MCP server connections are unavailable in this distribution.' };

	function unreadable<T extends object>(): T {
		return new Proxy(upcastPartial<T>({}), { get() { throw new Error('Removed runtime dependency accessed'); } });
	}

	function args() {
		return [unreadable<McpCollectionDefinition>(), unreadable<McpServerDefinition>(), unreadable<IMcpHostDelegate>(), unreadable<McpServerLaunch>(), unreadable<ILogger>(), true, unreadable<McpTaskManager>()] as const;
	}

	test('DI needs no services and preserves definition references without inspecting them', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const inputs = args();
		const connection = store.add(instantiation.createInstance(McpServerConnection, ...inputs));
		assert.strictEqual(connection.definition, inputs[1]);
		assert.strictEqual(connection.launchDefinition, inputs[3]);
		assert.deepStrictEqual(connection.state.get(), { state: McpConnectionState.Kind.Stopped });
		assert.strictEqual(connection.handler.get(), undefined);
	});

	test('start and retry return an explicit error without touching transport, methods or policy values', async () => {
		const connection = store.add(new McpServerConnection(...args(), unreadable<IInstantiationService>()));
		const states: McpConnectionState.Kind[] = [];
		store.add(autorun(reader => states.push(connection.state.read(reader).state)));
		for (let i = 0; i < 2; i++) {
			assert.deepStrictEqual(await connection.start(unreadable<IMcpClientMethods>(), unreadable<McpServerPolicyValues>()), unavailable);
			assert.deepStrictEqual(connection.state.get(), unavailable);
		}
		assert.deepStrictEqual(states, [McpConnectionState.Kind.Stopped, McpConnectionState.Kind.Error, McpConnectionState.Kind.Error]);
		assert.strictEqual(connection.handler.get(), undefined);
	});

	test('policy resolution rejects without reading values or invoking host variable resolution', async () => {
		const connection = store.add(new McpServerConnection(...args()));
		const result = await connection.resolvePolicyVariables(unreadable<string[]>()).then(() => 'unexpected success', error => error.message);
		assert.strictEqual(result, unavailable.message);
	});

	test('stop and dispose settle immediately and late starts stay stopped', async () => {
		const connection = store.add(new McpServerConnection(...args()));
		await connection.stop();
		await connection.start(unreadable<IMcpClientMethods>(), unreadable<McpServerPolicyValues>());
		await connection.stop();
		assert.deepStrictEqual(connection.state.get(), { state: McpConnectionState.Kind.Stopped });
		await connection.start(unreadable<IMcpClientMethods>(), unreadable<McpServerPolicyValues>());
		connection.dispose();
		connection.dispose();
		assert.deepStrictEqual(await connection.start(unreadable<IMcpClientMethods>(), unreadable<McpServerPolicyValues>()), { state: McpConnectionState.Kind.Stopped });
		await connection.stop();
		assert.strictEqual(connection.handler.get(), undefined);
	});

	test('lifecycle allocates no timers, handlers or sandbox notifications', async () => {
		const clock = sinon.useFakeTimers();
		try {
			const connection = store.add(new McpServerConnection(...args()));
			let sandboxEvents = 0;
			const handlers: unknown[] = [];
			store.add(connection.onPotentialSandboxBlock(() => sandboxEvents++));
			store.add(autorun(reader => handlers.push(connection.handler.read(reader))));
			await connection.start(unreadable<IMcpClientMethods>(), unreadable<McpServerPolicyValues>());
			await connection.stop();
			connection.dispose();
			await clock.tickAsync(1000);
			assert.deepStrictEqual({ timers: clock.countTimers(), handlers, sandboxEvents }, { timers: 0, handlers: [undefined], sandboxEvents: 0 });
		} finally {
			clock.restore();
		}
	});
});
