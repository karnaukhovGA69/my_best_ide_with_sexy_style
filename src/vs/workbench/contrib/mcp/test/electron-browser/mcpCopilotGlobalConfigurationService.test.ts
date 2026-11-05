/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Event } from '../../../../../base/common/event.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IAgentHostEnablementService } from '../../../../../platform/agentHost/common/agentHostEnablementService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { NativeMcpCopilotGlobalConfigurationService } from '../../electron-browser/mcpCopilotGlobalConfigurationService.js';

suite('Myself IDE disabled native Copilot MCP configuration', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('desktop registration needs no native IPC or other services', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		assert.strictEqual(await instantiation.createInstance(NativeMcpCopilotGlobalConfigurationService).getConfigurationResource(), undefined);
	});

	test('local resolution does not acquire a channel, load discovery data or schedule a timeout', async () => {
		const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		try {
			const calls: string[] = [];
			const channel: IChannel = {
				call: async <T>(): Promise<T> => { calls.push('load'); throw new Error('Must not request local discovery'); },
				listen: () => { calls.push('listen'); return Event.None; },
			};
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			instantiation.stub(IAgentHostEnablementService, { enabled: constObservable(true) });
			instantiation.stub(IRemoteAgentService, { getConnection: () => { calls.push('connection'); return null; } });
			instantiation.stub(IMainProcessService, { getChannel: () => { calls.push('channel'); return channel; } });
			instantiation.stub(ILogService, { warn: () => { calls.push('warn'); } });
			const service = instantiation.createInstance(NativeMcpCopilotGlobalConfigurationService);
			assert.deepStrictEqual(await Promise.all([service.getConfigurationResource(), service.getConfigurationResource()]), [undefined, undefined]);
			assert.deepStrictEqual(calls, []);
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			clock.restore();
		}
	});
});
