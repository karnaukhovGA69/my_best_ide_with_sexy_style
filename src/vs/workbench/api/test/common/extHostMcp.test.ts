/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import type * as vscode from 'vscode';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { McpServerDefinition, McpServerLaunch, McpServerTransportType } from '../../../contrib/mcp/common/mcpTypes.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { MainThreadCommandsShape } from '../../common/extHost.protocol.js';
import { ExtHostCommands } from '../../common/extHostCommands.js';
import { ExtHostMcpService } from '../../common/extHostMcp.js';
import { IExtHostTelemetry } from '../../common/extHostTelemetry.js';
import { SingleProxyRPCProtocol } from './testRPCProtocol.js';

suite('Myself IDE MCP extension API compatibility', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs without RPC, workspace, variable resolver or logging services', () => {
		const instantiation = store.add(new TestInstantiationService());
		const service = store.add(instantiation.createInstance(ExtHostMcpService));
		assert.deepStrictEqual(service.mcpServerDefinitions, []);
	});

	test('optional provider registration never reads callbacks or schedules work', async () => {
		const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		try {
			const service = store.add(new ExtHostMcpService());
			const provider = new Proxy(new class extends mock<vscode.McpServerDefinitionProvider>() { }, {
				get() { throw new Error('Must not inspect or subscribe to an MCP provider'); }
			});
			const registration = service.registerMcpConfigurationProvider(nullExtensionDescription, 'optional-mcp', provider);
			await service.$waitForInitialCollectionProviders();
			registration.dispose();
			registration.dispose();
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			clock.restore();
		}
	});

	test('late RPC messages cannot populate definitions or fire extension events', async () => {
		const service = store.add(new ExtHostMcpService());
		let events = 0;
		store.add(service.onDidChangeMcpServerDefinitions(() => events++));
		const definition: McpServerDefinition.Serialized = {
			id: 'fixture/server', label: 'Fixture', cacheNonce: '1',
			launch: { type: McpServerTransportType.HTTP, uri: URI.parse('https://example.invalid/mcp'), headers: [] }
		};
		service.$onDidChangeMcpServerDefinitions([definition]);
		service.$onDidChangeGatewayServers('old', [{ label: 'Fixture', address: URI.parse('https://example.invalid/mcp') }]);
		assert.deepStrictEqual({ definitions: service.mcpServerDefinitions, events, launch: await service.$resolveMcpLaunch('fixture', 'Fixture') }, { definitions: [], events: 0, launch: undefined });
		assert.ok(Object.isFrozen(service.mcpServerDefinitions));
	});

	test('explicit HTTP, stdio and gateway starts fail before reading launch inputs', async () => {
		const service = store.add(new ExtHostMcpService());
		for (const type of [McpServerTransportType.HTTP, McpServerTransportType.Stdio]) {
			const options = { get launch(): McpServerLaunch.Serialized { throw new Error(`Must not inspect launch ${type}`); } };
			assert.throws(() => service.$startMcp(1, options), /MCP is not available/);
		}
		assert.throws(() => service.$sendMessage(1, '{}'), /MCP is not available/);
		await assert.rejects(service.startMcpGateway(), /MCP is not available/);
		service.$stopMcp(1);
		service.$stopMcp(1);
	});

	test('compatibility helpers do not expand variables or environment secrets', async () => {
		const service = store.add(new ExtHostMcpService());
		const launch: McpServerLaunch.Serialized = { type: McpServerTransportType.Stdio, command: '${env:FIXTURE_COMMAND}', args: ['${input:prompt}'], env: {}, envFile: '/fixture/not-readable.env', cwd: '${workspaceFolder}', sandbox: undefined };
		assert.strictEqual(await service.$substituteVariables(URI.parse('test:workspace'), launch), launch);
		assert.strictEqual(await service.$expandEnvironmentVariables(launch, {}), launch);
		assert.deepStrictEqual(await service.$resolveMcpPolicyVariables(['${env:FIXTURE_TOKEN}']), { '${env:FIXTURE_TOKEN}': '${env:FIXTURE_TOKEN}' });
	});

	test('an extension with optional MCP can still register and execute an ordinary command', async () => {
		const service = store.add(new ExtHostMcpService());
		const commands = new ExtHostCommands(SingleProxyRPCProtocol(new class extends mock<MainThreadCommandsShape>() {
			override $registerCommand(): void { }
			override $unregisterCommand(): void { }
			override async $fireCommandActivationEvent(): Promise<void> { }
		}), store.add(new NullLogService()), new class extends mock<IExtHostTelemetry>() { });
		const provider: vscode.McpServerDefinitionProvider = {
			provideMcpServerDefinitions: () => { throw new Error('Optional MCP must remain inactive'); }
		};
		store.add(service.registerMcpConfigurationProvider(nullExtensionDescription, 'optional-mcp', provider));
		store.add(commands.registerCommand(false, 'fixture.ordinary', <T>() => 'ordinary-command-result' as T));
		assert.strictEqual(await commands.executeCommand('fixture.ordinary'), 'ordinary-command-result');
	});
});
