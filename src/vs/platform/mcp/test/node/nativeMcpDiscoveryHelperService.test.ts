/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IProcessEnvironment } from '../../../../base/common/platform.js';
import { ChannelClient, ChannelServer, ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { upcastPartial } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../instantiation/test/common/instantiationServiceMock.js';
import { RemoteAgentConnectionContext } from '../../../remote/common/remoteAgentEnvironment.js';
import { INativeMcpDiscoveryHelperService, NativeMcpDiscoveryHelperChannelName } from '../../common/nativeMcpDiscoveryHelper.js';
import { NativeMcpDiscoveryHelperChannel } from '../../node/nativeMcpDiscoveryHelperChannel.js';
import { NativeMcpDiscoveryHelperService } from '../../node/nativeMcpDiscoveryHelperService.js';

suite('Myself IDE disabled native MCP discovery helper', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const unavailable = /MCP discovery is not available/;

	test('remote default constructs through DI without infrastructure services', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		await assert.rejects(instantiation.createInstance(NativeMcpDiscoveryHelperService).load(), unavailable);
	});

	test('does not read or enumerate supplied environment variables', async () => {
		const reads: PropertyKey[] = [];
		const environment = new Proxy<IProcessEnvironment>({ COPILOT_HOME: '/fixture/copilot', APPDATA: '/fixture/app-data', XDG_CONFIG_HOME: '/fixture/config' }, {
			get(_target, key) { reads.push(key); throw new Error('Must not read discovery environment'); },
			ownKeys() { reads.push('ownKeys'); throw new Error('Must not enumerate discovery environment'); },
		});
		const service = new NativeMcpDiscoveryHelperService(environment);
		await assert.rejects(service.load(), unavailable);
		assert.deepStrictEqual(reads, []);
	});

	for (const mode of ['available', 'throwing', 'pending'] as const) {
		test(`does not invoke a ${mode} shell resolver or schedule background work`, async () => {
			const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
			try {
				let calls = 0;
				const resolveShellEnvironment = async (): Promise<IProcessEnvironment> => {
					calls++;
					if (mode === 'throwing') { throw new Error('Fixture shell error'); }
					if (mode === 'pending') { return new Promise(() => { }); }
					return { COPILOT_HOME: '/fixture/shell-copilot' };
				};
				const instantiation = store.add(new TestInstantiationService(undefined, true));
				const service = instantiation.createInstance(NativeMcpDiscoveryHelperService, {}, resolveShellEnvironment);
				const requests = Promise.allSettled([service.load(), service.load()]);
				// Check immediately so the old pending resolver cannot hang the regression.
				assert.strictEqual(calls, 0);
				for (const result of await requests) {
					assert.ok(result.status === 'rejected');
					assert.match(result.reason.message, unavailable);
				}
				assert.strictEqual(clock.countTimers(), 0);
			} finally {
				clock.restore();
			}
		});
	}

	test('main and remote IPC channels deliver an explicit refusal without fabricated roots', async () => {
		const service = new NativeMcpDiscoveryHelperService();
		const toClient = store.add(new Emitter<VSBuffer>());
		const toServer = store.add(new Emitter<VSBuffer>());
		const client = store.add(new ChannelClient({ onMessage: toClient.event, send: buffer => toServer.fire(buffer) }));
		const context = upcastPartial<RemoteAgentConnectionContext>({ remoteAuthority: 'fixture' });
		const server = store.add(new ChannelServer({ onMessage: toServer.event, send: buffer => toClient.fire(buffer) }, context));
		server.registerChannel(NativeMcpDiscoveryHelperChannelName, ProxyChannel.fromService(service, store.add(new DisposableStore())));
		server.registerChannel('fixture-remote-discovery', new NativeMcpDiscoveryHelperChannel(undefined, service));
		for (const name of [NativeMcpDiscoveryHelperChannelName, 'fixture-remote-discovery']) {
			const proxy = ProxyChannel.toService<INativeMcpDiscoveryHelperService>(client.getChannel(name));
			await assert.rejects(proxy.load(), unavailable);
			await assert.rejects(proxy.load(), unavailable);
		}
	});
});
