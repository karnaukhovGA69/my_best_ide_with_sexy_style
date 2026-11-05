/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { autorun } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { McpToolCallUI } from '../../browser/mcpToolCallUI.js';
import { IMcpToolCallUIData } from '../../common/mcpTypes.js';
import { MCP } from '../../common/modelContextProtocol.js';

suite('McpToolCallUI - transports removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disabled = 'MCP Apps are disabled in Myself IDE.';
	const renderData: IMcpToolCallUIData[] = [
		{ kind: 'local', serverDefinitionId: 'test', collectionId: 'test', resourceUri: 'ui://test/app' },
		{ kind: 'agentHost', connectionAuthority: 'test-host', channel: 'mcp://test/app', serverId: 'test', resourceUri: 'ui://test/app' },
	];

	async function rejection(promise: Promise<unknown>): Promise<string> {
		return promise.then(() => 'Unexpected success', error => error instanceof Error ? error.message : String(error));
	}

	for (const data of renderData) {
		test(`${data.kind} requests fail without resolving infrastructure`, async () => {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			const ui = store.add(instantiation.createInstance(McpToolCallUI, data));
			assert.strictEqual(ui.uiData, data);
			for (const token of [CancellationToken.None, CancellationToken.Cancelled]) {
				const errors = await Promise.all([
					rejection(ui.loadResource(token)),
					rejection(ui.callTool({ name: 'test' }, token)),
					rejection(ui.readResource('ui://test/app', token)),
					rejection(ui.sampling({ messages: [], maxTokens: 1 }, token)),
				]);
				assert.deepStrictEqual(errors, [disabled, disabled, disabled, disabled]);
			}
		});
	}

	test('does not inspect render data, request payloads or tokens', async () => {
		const data = new Proxy(upcastPartial<IMcpToolCallUIData>({}), { get() { throw new Error('Render data read'); } });
		const params = new Proxy(upcastPartial<MCP.CallToolRequestParams>({}), { get() { throw new Error('Request read'); } });
		const token = new Proxy(upcastPartial<CancellationToken>({}), { get() { throw new Error('Token read'); } });
		const ui = store.add(new McpToolCallUI(data));
		assert.deepStrictEqual(await Promise.all([rejection(ui.loadResource(token)), rejection(ui.callTool(params, token))]), [disabled, disabled]);
		assert.strictEqual(ui.uiData, data);
	});

	test('notifications and host context remain inert across logging and disposal', async () => {
		const ui = store.add(new McpToolCallUI(renderData[0]));
		let notifications = 0;
		let contexts = 0;
		store.add(ui.onNotification(() => notifications++));
		store.add(autorun(reader => { ui.hostContext.read(reader); contexts++; }));
		const log = new Proxy(upcastPartial<MCP.LoggingMessageNotificationParams>({}), { get() { throw new Error('Log read'); } });
		await ui.log(log);
		ui.dispose();
		ui.dispose();
		await ui.log(log);
		assert.strictEqual(await rejection(ui.loadResource(CancellationToken.None)), disabled);
		assert.deepStrictEqual({ notifications, contexts, context: ui.hostContext.get(), frozen: Object.isFrozen(ui.hostContext.get()) }, {
			notifications: 0, contexts: 1, context: {}, frozen: true,
		});
	});
});
