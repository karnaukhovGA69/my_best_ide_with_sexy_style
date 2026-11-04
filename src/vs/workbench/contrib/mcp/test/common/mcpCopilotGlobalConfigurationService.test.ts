/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { Platform } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IAgentHostEnablementService } from '../../../../../platform/agentHost/common/agentHostEnablementService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INativeMcpDiscoveryData } from '../../../../../platform/mcp/common/nativeMcpDiscoveryHelper.js';
import { IRemoteAgentConnection, IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { McpCopilotGlobalConfigurationService } from '../../common/mcpCopilotGlobalConfigurationService.js';

suite('Myself IDE disabled Copilot MCP configuration', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs and resolves without Agent Host, remote or logging services', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = instantiation.createInstance(McpCopilotGlobalConfigurationService);
		assert.strictEqual(await service.getConfigurationResource(), undefined);
	});

	for (const mode of ['available', 'throwing', 'pending'] as const) {
		test(`never calls remote discovery when ${mode}, even after enablement changes`, async () => {
			const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
			try {
				const calls: string[] = [];
				const enabled = observableValue('fixture enablement', false);
				const data: INativeMcpDiscoveryData = {
					platform: Platform.Linux,
					homedir: URI.parse('vscode-remote://fixture/home/test'),
					copilotHome: URI.parse('vscode-remote://fixture/custom-copilot'),
				};
				const channel: IChannel = {
					call: async <T>(): Promise<T> => {
						calls.push('load');
						if (mode === 'throwing') { throw new Error('Fixture discovery failure'); }
						if (mode === 'pending') { return new Promise<T>(() => { }); }
						return JSON.parse(JSON.stringify(data)) as T;
					},
					listen: () => { calls.push('listen'); return Event.None; },
				};
				const connection = upcastPartial<IRemoteAgentConnection>({
					withChannel: async <T extends IChannel, R>(_name: string, callback: (channel: T) => Promise<R>): Promise<R> => {
						calls.push('channel');
						return callback(channel as T);
					},
				});
				const instantiation = store.add(new TestInstantiationService(undefined, true));
				instantiation.stub(IAgentHostEnablementService, { enabled });
				instantiation.stub(IRemoteAgentService, { getConnection: () => { calls.push('connection'); return connection; } });
				instantiation.stub(ILogService, { warn: () => { calls.push('warn'); } });
				const service = instantiation.createInstance(McpCopilotGlobalConfigurationService);
				assert.strictEqual(await service.getConfigurationResource(), undefined);
				enabled.set(true, undefined);
				const requests = Promise.all([service.getConfigurationResource(), service.getConfigurationResource()]);
				// Complete an old timeout during the sensitivity check instead of hanging the test.
				await clock.tickAsync(5001);
				assert.deepStrictEqual(await requests, [undefined, undefined]);
				assert.deepStrictEqual(calls, []);
				assert.strictEqual(clock.countTimers(), 0);
			} finally {
				clock.restore();
			}
		});
	}
});
