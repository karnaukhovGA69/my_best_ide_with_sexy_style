/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService, NullLogger } from '../../../log/common/log.js';
import { IMcpGatewayToolInvoker } from '../../common/mcpGateway.js';
import { McpGatewayService } from '../../node/mcpGatewayService.js';

suite('Myself IDE disabled platform MCP gateway', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs through DI without logging or network dependencies', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		store.add(instantiation.createInstance(McpGatewayService));
	});

	test('rejects requests without listening, creating a logger, reading invokers or scheduling work', async () => {
		const { Server } = await import('http');
		const sandbox = sinon.createSandbox();
		const clock = sandbox.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		const listen = sandbox.stub(Server.prototype, 'listen').throws(new Error('Must not open a gateway listener'));
		try {
			let loggerRequests = 0;
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			instantiation.stub(ILoggerService, { createLogger: () => { loggerRequests++; return new NullLogger(); } });
			const service = store.add(instantiation.createInstance(McpGatewayService));
			const invoker = new Proxy(new class extends mock<IMcpGatewayToolInvoker>() { }, {
				get() { throw new Error('Must not read or subscribe to a tool invoker'); }
			});
			const context = { toString() { throw new Error('Must not serialize a client context'); } };
			await Promise.all([undefined, null, 'local-client', context].map(client =>
				assert.rejects(service.createGateway(client, invoker), /MCP is not available/)
			));
			await assert.rejects(service.createGateway('without-invoker'), /MCP is not available/);
			assert.strictEqual(listen.callCount, 0);
			assert.strictEqual(loggerRequests, 0);
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('stale cleanup is idempotent and cannot enable a disposed service', async () => {
		const service = store.add(new McpGatewayService());
		for (let i = 0; i < 2; i++) {
			await service.disposeGateway('old-gateway');
			service.disposeGatewaysForClient('old-client');
			service.dispose();
		}
		await assert.rejects(service.createGateway('after-dispose'), /MCP is not available/);
	});
});
