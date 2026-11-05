/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { WorkbenchMcpGatewayService } from '../../electron-browser/mcpGatewayService.js';
import { McpGatewayToolBrokerContribution } from '../../electron-browser/mcpGatewayToolBrokerContribution.js';

suite('MCP gateway disabled - electron-browser', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('gateway service does not require remote, IPC or logging services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		instantiation.createInstance(WorkbenchMcpGatewayService);
	});

	test('startup broker does not require MCP, remote, IPC or logging services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		instantiation.createInstance(McpGatewayToolBrokerContribution);
	});

	for (const inRemote of [false, true]) {
		test(`rejects ${inRemote ? 'remote' : 'local'} gateways with and without a chat session`, async () => {
			const gateway = new WorkbenchMcpGatewayService();
			for (const session of [undefined, URI.from({ scheme: 'test-session', path: '/gateway-disabled' })]) {
				const outcome = await gateway.createGateway(inRemote, session).then(
					() => 'Gateway unexpectedly created',
					error => error instanceof Error ? error.message : String(error),
				);
				assert.strictEqual(outcome, 'MCP gateways are disabled in Myself IDE.');
			}
		});
	}
});
