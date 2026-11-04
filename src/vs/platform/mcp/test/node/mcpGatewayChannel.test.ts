/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ChannelClient, ChannelServer, IPCServer } from '../../../../base/parts/ipc/common/ipc.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService } from '../../../log/common/log.js';
import { IMcpGatewayService, McpGatewayChannelName } from '../../common/mcpGateway.js';
import { McpGatewayChannel } from '../../node/mcpGatewayChannel.js';

suite('Myself IDE disabled platform MCP gateway channel', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const ipcServer = new Proxy(new class extends mock<IPCServer<string>>() { }, {
		get() { throw new Error('Must not acquire a broker or subscribe to client connections'); }
	});

	test('remote DI construction needs no gateway or logger services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		store.add(instantiation.createInstance(McpGatewayChannel<string>, ipcServer));
	});

	test('main-process constructor and stale requests do not touch supplied services or arguments', async () => {
		const service = new Proxy(new class extends mock<IMcpGatewayService>() { }, {
			get() { throw new Error('Must not invoke a gateway backend'); }
		});
		const logger = new Proxy(new class extends mock<ILoggerService>() { }, {
			get() { throw new Error('Must not request or write a gateway log'); }
		});
		const args = new Proxy({}, { get() { throw new Error('Must not read a chat session or gateway argument'); } });
		const channel = store.add(new McpGatewayChannel(ipcServer, service, logger));
		await assert.rejects(channel.call('client', 'createGateway', args), /MCP is not available/);
		assert.strictEqual(await channel.call('client', 'disposeGateway', args), undefined);
		assert.strictEqual(await channel.call('client', 'disposeGateway', args), undefined);
		channel.dispose();
		await assert.rejects(channel.call('client', 'createGateway'), /MCP is not available/);
	});

	test('event contract is inert and invalid operations still fail explicitly', async () => {
		const channel = store.add(new McpGatewayChannel(ipcServer));
		const listener = channel.listen('client', 'onDidChangeGatewayServers')(() => assert.fail('Unexpected gateway event'));
		store.add(listener);
		assert.strictEqual(channel.listen('client', 'onDidChangeGatewayServers'), Event.None);
		listener.dispose();
		listener.dispose();
		assert.throws(() => channel.listen('client', 'unknown'), /Invalid listen/);
		await assert.rejects(channel.call('client', 'unknown'), /Invalid call/);
	});

	test('registered IPC endpoint rejects promptly without a broker channel', async () => {
		const toClient = store.add(new Emitter<VSBuffer>());
		const toServer = store.add(new Emitter<VSBuffer>());
		const client = store.add(new ChannelClient({ onMessage: toClient.event, send: buffer => toServer.fire(buffer) }));
		const server = store.add(new ChannelServer({ onMessage: toServer.event, send: buffer => toClient.fire(buffer) }, 'remote-client'));
		server.registerChannel(McpGatewayChannelName, store.add(new McpGatewayChannel(ipcServer)));
		const channel = client.getChannel(McpGatewayChannelName);
		await assert.rejects(channel.call('createGateway', { chatSessionResource: 'test:session' }), /MCP is not available/);
		assert.strictEqual(await channel.call('disposeGateway', 'old-gateway'), undefined);
		await assert.rejects(channel.call('unknown'), /Invalid call/);
	});
});
