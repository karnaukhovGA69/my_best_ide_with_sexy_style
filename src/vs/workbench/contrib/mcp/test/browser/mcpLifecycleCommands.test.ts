/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ListMcpServerCommand, RestartServer, StartServer, StopServer, ResetMcpTrustCommand, ResetMcpCachedTools, McpSkipCurrentAutostartCommand } from '../../browser/mcpCommands.js';

suite('Workbench - MCP - list and lifecycle commands removed', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	for (const Command of [ListMcpServerCommand, RestartServer, StartServer, StopServer, ResetMcpTrustCommand, ResetMcpCachedTools, McpSkipCurrentAutostartCommand]) {
		test(`${Command.name} refuses local, wildcard and agent-host operations before inspecting arguments or services`, async () => {
			const command: Action2 = new Command();
			const accessor: ServicesAccessor = { get(): never { throw new Error('Service accessed'); } };
			const unreadable = new Proxy({}, { get() { throw new Error('Arguments accessed'); } });
			for (const input of [undefined, 'fixture', '*', { agentHostSession: URI.parse('test:session'), serverId: 'fixture' }, unreadable]) {
				const message = await Promise.resolve().then(() => command.run(accessor, input, unreadable)).then(() => 'unexpected success', error => error.message);
				assert.strictEqual(message, 'MCP commands are unavailable in this distribution.');
			}
		});
	}
});
