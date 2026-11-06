/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IChatService } from '../../../chat/common/chatService/chatService.js';
import { McpElicitationService } from '../../browser/mcpElicitationService.js';
import { ElicitResult, IMcpServer, IMcpToolCallContext, McpError } from '../../common/mcpTypes.js';
import { MCP } from '../../common/modelContextProtocol.js';

suite('Myself IDE disabled MCP elicitation', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const server = new Proxy(new class extends mock<IMcpServer>() { }, {
		get() { throw new Error('Must not read or subscribe to an MCP server'); }
	});
	const requests: { name: string; params: MCP.ElicitRequest['params'] }[] = [
		{ name: 'form', params: { mode: 'form', message: 'Fixture form', requestedSchema: { type: 'object', properties: { answer: { type: 'string' } } } } },
		{ name: 'legacy form', params: { message: 'Fixture legacy form', requestedSchema: { type: 'object', properties: {} } } },
		{ name: 'URL', params: { mode: 'url', message: 'Fixture URL', elicitationId: 'fixture', url: 'https://example.invalid/authorize' } },
	];

	async function assertUnavailable(promise: Promise<ElicitResult>): Promise<void> {
		// Explicit assertions also validate the error under the browser assert shim.
		await promise.then(
			() => assert.fail('MCP elicitation must not return an accepted/cancelled UI result'),
			error => {
				assert.ok(error instanceof McpError);
				assert.strictEqual(error.code, -32000);
				assert.match(error.message, /MCP elicitation is not available/);
			}
		);
	}

	test('constructs without notification, quick input, chat or opener services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.createInstance(McpElicitationService);
	});

	test('rejects without inspecting server, context, request or cancellation callbacks', async () => {
		const service = new McpElicitationService();
		const context = new Proxy(new class extends mock<IMcpToolCallContext>() { }, { get() { throw new Error('Must not inspect tool context'); } });
		const request = new Proxy(requests[0].params, { get() { throw new Error('Must not inspect elicitation parameters'); } });
		const token = new Proxy(new class extends mock<CancellationToken>() { }, { get() { throw new Error('Must not inspect or subscribe to cancellation'); } });
		await assertUnavailable(service.elicit(server, context, request, token));
	});

	for (const request of requests) {
		test(`rejects ${request.name} requests without UI, URL opening or timers`, async () => {
			const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
			try {
				const calls: string[] = [];
				const instantiation = store.add(new TestInstantiationService(undefined, true));
				instantiation.stub(INotificationService, { notify: () => { calls.push('notify'); throw new Error('Must not show a notification'); } });
				instantiation.stub(IQuickInputService, { createQuickPick: () => { calls.push('quickpick'); throw new Error('Must not collect form input'); } });
				instantiation.stub(IChatService, { getSession: () => { calls.push('chat'); throw new Error('Must not obtain a chat session'); } });
				instantiation.stub(IOpenerService, { open: async () => { calls.push('open'); throw new Error('Must not open a URL'); } });
				const service = instantiation.createInstance(McpElicitationService);
				const context = upcastPartial<IMcpToolCallContext>({ chatSessionResource: URI.parse('test:chat') });
				await Promise.all([undefined, context].flatMap(context => [CancellationToken.None, CancellationToken.Cancelled].map(token =>
					assertUnavailable(service.elicit(server, context, request.params, token))
				)));
				assert.deepStrictEqual(calls, []);
				assert.strictEqual(clock.countTimers(), 0);
			} finally {
				clock.restore();
			}
		});
	}

});
