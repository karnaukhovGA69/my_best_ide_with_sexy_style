/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { LogLevel } from '../../../../platform/log/common/log.js';
import { McpCollectionDefinition, McpConnectionState } from '../../../contrib/mcp/common/mcpTypes.js';
import { ExtHostCustomersRegistry, IExtHostContext } from '../../../services/extensions/common/extHostCustomers.js';
import { MainThreadMcp } from '../../browser/mainThreadMcp.js';
import { IAuthResourceMetadataSource, IAuthServerMetadataSource, IMcpAuthenticationDetails, MainContext } from '../../common/extHost.protocol.js';

suite('Myself IDE inert main-thread MCP bridge', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const context = new Proxy(new class extends mock<IExtHostContext>() { }, {
		get() { throw new Error('Must not access extension-host context or request an MCP proxy'); }
	});

	test('named RPC customer remains constructible without MCP/auth services or timers', () => {
		const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		try {
			const instantiation = store.add(new TestInstantiationService());
			store.add(instantiation.createInstance(MainThreadMcp, context));
			assert.ok(ExtHostCustomersRegistry.getNamedCustomers().some(([id, ctor]) => id === MainContext.MainThreadMcp && ctor === MainThreadMcp));
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			clock.restore();
		}
	});

	test('request checks deny every URL rather than authorize an unsandboxed fallback', async () => {
		const bridge = store.add(new MainThreadMcp(context));
		for (const url of ['https://example.invalid/mcp', 'http://localhost:1234', 'unix:///fixture/socket']) {
			assert.match((await bridge.$checkMcpServerAllowed(1, url))!, /MCP is not available/);
		}
	});

	test('MCP token requests do not use GitHub auth or dynamic OAuth registration', async () => {
		const bridge = store.add(new MainThreadMcp(context));
		const details = new Proxy(new class extends mock<IMcpAuthenticationDetails>() { }, {
			get() { throw new Error('Must not read MCP OAuth metadata'); }
		});
		assert.deepStrictEqual(await Promise.all([
			bridge.$getTokenForProviderId(1, 'github', ['repo'], { forceNewRegistration: true }),
			bridge.$getTokenFromServerMetadata(1, details, { errorOnUserInteraction: true })
		]), [undefined, undefined]);
	});

	test('stale RPC notifications and cleanup remain harmless without loading services', () => {
		const bridge = store.add(new MainThreadMcp(context));
		const collection = new Proxy(new class extends mock<McpCollectionDefinition.FromExtHost>() { }, {
			get() { throw new Error('Must not read or publish old MCP collection'); }
		});
		bridge.$upsertMcpCollection(collection, []);
		bridge.$deleteMcpCollection('old');
		bridge.$onDidChangeState(1, { state: McpConnectionState.Kind.Running });
		bridge.$onDidPublishLog(1, LogLevel.Info, 'fixture');
		bridge.$onDidReceiveMessage(1, '{}');
		bridge.$logMcpAuthSetup({ resourceMetadataSource: IAuthResourceMetadataSource.WellKnown, serverMetadataSource: IAuthServerMetadataSource.Default });
		bridge.$disposeMcpGateway('old');
		bridge.$disposeMcpGateway('old');
	});

	test('explicit gateway request rejects without opening a listener', async () => {
		const bridge = store.add(new MainThreadMcp(context));
		await assert.rejects(bridge.$startMcpGateway(URI.parse('test:chat')), /MCP is not available/);
	});
});
