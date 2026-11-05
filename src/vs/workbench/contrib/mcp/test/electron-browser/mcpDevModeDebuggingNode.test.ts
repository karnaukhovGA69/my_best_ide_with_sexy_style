/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INativeHostService } from '../../../../../platform/native/common/native.js';
import { IDebugService } from '../../../debug/common/debug.js';
import { McpServerDefinition, McpServerLaunch, McpServerTransportType } from '../../common/mcpTypes.js';
import { McpDevModeDebuggingNode } from '../../electron-browser/mcpDevModeDebuggingNode.js';

suite('Myself IDE disabled native MCP debugging', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('desktop registration constructs without native host or debugging services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.createInstance(McpDevModeDebuggingNode);
	});

	test('does not activate debuggers, discover debugpy, probe ports or schedule polling', async () => {
		const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		try {
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			instantiation.stub(INativeHostService, new Proxy(new class extends mock<INativeHostService>() { }, {
				get() { throw new Error('Must not find or probe native ports'); }
			}));
			instantiation.stub(IDebugService, new Proxy(new class extends mock<IDebugService>() { }, {
				get() { throw new Error('Must not start an MCP debug session'); }
			}));
			instantiation.stub(ICommandService, new Proxy(new class extends mock<ICommandService>() { }, {
				get() { throw new Error('Must not activate a debugger extension command'); }
			}));
			const service = instantiation.createInstance(McpDevModeDebuggingNode);
			for (const debug of [{ type: 'node' } as const, { type: 'debugpy' } as const]) {
				const launch: McpServerLaunch = { type: McpServerTransportType.Stdio, command: debug.type === 'node' ? 'node' : 'python', args: [], cwd: undefined, env: {}, envFile: undefined, sandbox: undefined };
				const definition: McpServerDefinition = { id: 'fixture', label: 'Fixture', cacheNonce: '1', devMode: { debug }, launch };
				await service.transform(definition, launch).then(
					() => assert.fail('MCP debugging must reject'),
					error => {
						assert.ok(error instanceof Error);
						assert.match(error.message, /MCP debugging is not available/);
					}
				);
			}
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			clock.restore();
		}
	});
});
