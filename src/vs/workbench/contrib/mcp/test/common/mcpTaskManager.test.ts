/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IMcpTaskInternal, McpTaskManager } from '../../common/mcpTaskManager.js';
import { McpServerRequestHandler } from '../../common/mcpServerRequestHandler.js';
import { McpError } from '../../common/mcpTypes.js';

suite('McpTaskManager - implementation removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disabled = { code: -32000, message: 'MCP tasks are disabled in Myself IDE.' };

	async function errorOf<T>(operation: () => T | Promise<T>) {
		try {
			await operation();
			return undefined;
		} catch (error) {
			if (!(error instanceof McpError)) {
				throw error;
			}
			return { code: error.code, message: error.message };
		}
	}

	test('refuses server tasks without invoking the executor for any TTL', async () => {
		const manager = store.add(new McpTaskManager());
		let executions = 0;
		for (const ttl of [null, 0, 1000]) {
			assert.deepStrictEqual(await errorOf(() => manager.createTask(ttl, async () => { executions++; return {}; })), disabled);
		}
		assert.deepStrictEqual({ executions, inventory: manager.listTasks() }, { executions: 0, inventory: { tasks: [] } });
	});

	test('status, result and cancellation return protocol errors without pending work', async () => {
		const manager = store.add(new McpTaskManager());
		assert.deepStrictEqual(await Promise.all([
			errorOf(() => manager.getTask('missing')),
			errorOf(() => manager.getTaskResult('missing')),
			errorOf(() => manager.cancelTask('missing')),
		]), [disabled, disabled, disabled]);
	});

	test('refuses client task ownership after disposing without reading its identity or reconnecting', async () => {
		const manager = store.add(new McpTaskManager());
		let disposals = 0;
		const task = upcastPartial<IMcpTaskInternal>({
			get id(): never { throw new Error('Task identity read'); },
			setHandler() { throw new Error('Task reconnected'); },
			dispose() { disposals++; },
		});
		assert.deepStrictEqual(await errorOf(() => manager.adoptClientTask(task)), disabled);
		manager.setHandler(new Proxy(upcastPartial<McpServerRequestHandler>({}), { get() { throw new Error('Handler accessed'); } }));
		manager.abandonClientTask('missing');
		assert.deepStrictEqual({ disposals, lookup: manager.getClientTask('missing') }, { disposals: 1, lookup: undefined });
	});

	test('empty inventory and events stay independent and safe after disposal', () => {
		const manager = store.add(new McpTaskManager());
		let events = 0;
		store.add(manager.onDidUpdateTask(() => events++));
		manager.listTasks().tasks.push({ taskId: 'stale', status: 'working', ttl: null, createdAt: '', lastUpdatedAt: '' });
		manager.setHandler(undefined);
		manager.dispose();
		manager.dispose();
		manager.abandonClientTask('stale');
		assert.deepStrictEqual({ inventory: manager.listTasks(), events }, { inventory: { tasks: [] }, events: 0 });
	});
});
