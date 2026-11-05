/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { McpSamplingService } from '../../common/mcpSamplingService.js';
import { IMcpServer, ISamplingOptions, McpError } from '../../common/mcpTypes.js';

suite('Myself IDE disabled MCP sampling', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const server = new Proxy(new class extends mock<IMcpServer>() { }, {
		get() { throw new Error('Must not read server definitions or subscribe to server state'); }
	});
	const isUnavailable = (error: unknown): boolean => error instanceof McpError
		&& error.code === -32000
		&& /MCP sampling is not available/.test(error.message);

	test('constructs without language models, configuration, UI or log dependencies', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		store.add(instantiation.createInstance(McpSamplingService));
	});

	test('rejects without reading prompts, context, model preferences or cancellation callbacks', async () => {
		const service = store.add(new McpSamplingService());
		const options = new Proxy(new class extends mock<ISamplingOptions>() { }, {
			get() { throw new Error('Must not inspect a sampling request'); }
		});
		const token = new Proxy(new class extends mock<CancellationToken>() { }, {
			get() { throw new Error('Must not read or subscribe to a sampling token'); }
		});
		await assert.rejects(service.sample(options, token), isUnavailable);
	});

	test('concurrent requests during and outside chat settle without timers or queues', async () => {
		const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		try {
			const service = store.add(new McpSamplingService());
			await Promise.all([false, true].flatMap(isDuringToolCall => [CancellationToken.None, CancellationToken.Cancelled].map(token =>
				assert.rejects(service.sample({
					server, isDuringToolCall,
					params: { messages: [{ role: 'user', content: { type: 'text', text: 'fixture' } }], maxTokens: 1, modelPreferences: { hints: [{ name: 'fixture-model' }] } }
				}, token), isUnavailable)
			)));
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			clock.restore();
		}
	});

	test('configuration and logs stay denied and empty without reading the server', () => {
		const service = store.add(new McpSamplingService());
		const config = service.getConfig(server);
		config.allowedDuringChat = true;
		config.allowedOutsideChat = true;
		config.allowedModels!.push('fixture-model');
		assert.deepStrictEqual(service.getConfig(server), { allowedDuringChat: false, allowedOutsideChat: false, allowedModels: [] });
		assert.strictEqual(service.hasLogs(server), false);
		assert.strictEqual(service.getLogText(server), '');
	});

	test('configuration updates reject without invoking mutation callbacks', async () => {
		const service = store.add(new McpSamplingService());
		await assert.rejects(service.updateConfig(server, () => assert.fail('Must not run a permission mutation')), isUnavailable);
		assert.deepStrictEqual(service.getConfig(server), { allowedDuringChat: false, allowedOutsideChat: false, allowedModels: [] });
	});

	test('dispose is idempotent and cannot enable later requests', async () => {
		const service = store.add(new McpSamplingService());
		service.dispose();
		service.dispose();
		await assert.rejects(service.sample({ server, isDuringToolCall: true, params: { messages: [], maxTokens: 1 } }), isUnavailable);
		await assert.rejects(service.updateConfig(server, () => assert.fail('Must not mutate after disposal')), isUnavailable);
		assert.strictEqual(service.hasLogs(server), false);
	});
});
