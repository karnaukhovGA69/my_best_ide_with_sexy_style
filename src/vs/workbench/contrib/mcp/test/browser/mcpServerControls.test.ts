/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { UninstallAction, EnableMcpServerGloballyAction, EnableMcpServerForWorkspaceAction, DisableMcpServerGloballyAction, DisableMcpServerForWorkspaceAction, StartServerAction, StopServerAction, RestartServerAction, ConfigureModelAccessAction, ShowSamplingRequestsAction, BrowseResourcesAction, McpServerStatusAction } from '../../browser/mcpServerActions.js';
import { IWorkbenchMcpServer } from '../../common/mcpTypes.js';

suite('Workbench - MCP - server controls removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const Action of [UninstallAction, EnableMcpServerGloballyAction, EnableMcpServerForWorkspaceAction, DisableMcpServerGloballyAction, DisableMcpServerForWorkspaceAction, StartServerAction, StopServerAction, RestartServerAction, ConfigureModelAccessAction, ShowSamplingRequestsAction, BrowseResourcesAction, McpServerStatusAction]) {
		test(`${Action.name} constructs without services, stays hidden and refuses before accessing server metadata`, async () => {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			const action = store.add(instantiation.createInstance(Action));
			const server = new Proxy(upcastPartial<IWorkbenchMcpServer>({}), { get() { throw new Error('Server metadata accessed'); } });
			for (const input of [null, server]) {
				action.mcpServer = input;
				action.update();
				assert.deepStrictEqual({ enabled: action.enabled, hidden: action.hidden }, { enabled: false, hidden: true });
				const message = await action.run().then(() => 'unexpected success', error => error.message);
				assert.strictEqual(message, 'MCP server controls are unavailable in this distribution.');
			}
		});
	}
	test('status widget contract stays empty and does not retain consumer changes or emit events', () => {
		const action = store.add(new McpServerStatusAction());
		let events = 0;
		store.add(action.onDidChangeStatus(() => events++));
		action.status.push({ message: { value: 'stale' } });
		action.update();
		assert.deepStrictEqual({ status: action.status, events }, { status: [], events: 0 });
	});

});
