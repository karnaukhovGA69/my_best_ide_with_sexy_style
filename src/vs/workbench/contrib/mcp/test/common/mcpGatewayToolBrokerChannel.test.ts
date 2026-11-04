/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { derived, observableValue } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChannelClient, ChannelServer } from '../../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { McpGatewayToolBrokerChannel } from '../../common/mcpGatewayToolBrokerChannel.js';
import { IMcpServer, IMcpService } from '../../common/mcpTypes.js';

suite('McpGatewayToolBrokerChannel - implementation removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disabled = 'MCP gateway tool and resource access is disabled in Myself IDE.';
	const listCommands = ['listServers', 'listToolsForServer', 'listResourcesForServer', 'listResourceTemplatesForServer'];
	const events = ['onDidChangeTools', 'onDidChangeResources', 'onDidChangeServers'];
	const poisonArgs = { get serverId(): never { throw new Error('Arguments read'); } };

	async function rejection(promise: Promise<unknown>): Promise<string> {
		return promise.then(() => 'Unexpected success', error => error instanceof Error ? error.message : String(error));
	}

	test('constructs and disposes without MCP or logger services', () => {
		const channel = store.add(new McpGatewayToolBrokerChannel());
		channel.dispose();
		channel.dispose();
	});

	test('legacy constructor arguments are not read or observed', async () => {
		const calls: string[] = [];
		const servers = observableValue<readonly IMcpServer[]>('servers', []);
		const service = upcastPartial<IMcpService>({ servers: derived(reader => {
			calls.push('read servers');
			return servers.read(reader);
		}) });
		const logger = upcastPartial<ILogService>({ get debug(): never { throw new Error('Logger read'); } });
		const channel = store.add(new McpGatewayToolBrokerChannel(service, logger, 1));
		for (const event of events) {
			store.add(channel.listen(undefined, event)(() => calls.push(event)));
		}
		servers.set([upcastPartial<IMcpServer>({})], undefined);
		const lists = [];
		for (const command of listCommands) {
			lists.push(await channel.call(undefined, command, poisonArgs));
		}
		channel.dispose();
		servers.set([], undefined);
		assert.deepStrictEqual({ calls, lists }, { calls: [], lists: [[], [], [], []] });
	});

	test('list operations accept absent and malformed arguments without startup', async () => {
		const channel = store.add(new McpGatewayToolBrokerChannel());
		const results = [];
		for (const command of listCommands) {
			for (const args of [undefined, null, poisonArgs]) {
				results.push(await channel.call(undefined, command, args, CancellationToken.Cancelled));
			}
		}
		assert.deepStrictEqual(results, Array.from({ length: 12 }, () => []));
	});

	test('rejects tool execution and resource reads before reading arguments or cancellation', async () => {
		const channel = store.add(new McpGatewayToolBrokerChannel());
		const token = upcastPartial<CancellationToken>({ get isCancellationRequested(): never { throw new Error('Token read'); } });
		const results = [];
		for (const command of ['callToolForServer', 'readResourceForServer']) {
			results.push(await rejection(channel.call(undefined, command, poisonArgs, token)));
		}
		assert.deepStrictEqual(results, [disabled, disabled]);
	});

	test('unknown operations remain explicit errors', async () => {
		const channel = store.add(new McpGatewayToolBrokerChannel());
		let listenError = '';
		try { channel.listen(undefined, 'unknown'); } catch (error) { listenError = String(error); }
		assert.deepStrictEqual({ listenError, callError: await rejection(channel.call(undefined, 'unknown')) }, {
			listenError: 'Error: Invalid listen: unknown', callError: 'Invalid call: unknown',
		});
	});

	test('serves empty lists and explicit failures through a real IPC roundtrip', async () => {
		const toClient = store.add(new Emitter<VSBuffer>());
		const toServer = store.add(new Emitter<VSBuffer>());
		const client = store.add(new ChannelClient({ onMessage: toClient.event, send: buffer => toServer.fire(buffer) }));
		const server = store.add(new ChannelServer({ onMessage: toServer.event, send: buffer => toClient.fire(buffer) }, 'test'));
		server.registerChannel('broker', store.add(new McpGatewayToolBrokerChannel()));
		const channel = client.getChannel('broker');
		const observed: string[] = [];
		for (const event of events) {
			store.add(channel.listen(event)(() => observed.push(event)));
		}
		const lists = [];
		for (const command of listCommands) {
			lists.push(await channel.call(command, { serverId: 'test-server' }));
		}
		const toolError = await rejection(channel.call('callToolForServer', { serverId: 'test-server', name: 'test-tool' }));
		const resourceError = await rejection(channel.call('readResourceForServer', { serverId: 'test-server', uri: 'test:resource' }));
		const unknownError = await rejection(channel.call('unknown'));
		assert.deepStrictEqual({ lists, toolError, resourceError, unknownError, observed }, {
			lists: [[], [], [], []], toolError: disabled, resourceError: disabled, unknownError: 'Invalid call: unknown', observed: [],
		});
	});
});
