/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { McpServerLaunch } from '../../../contrib/mcp/common/mcpTypes.js';
import { NodeExtHostMpcService } from '../../node/extHostMcpNode.js';

suite('Myself IDE Node MCP API compatibility', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('Node implementation does not need RPC, process or file services', () => {
		const instantiation = store.add(new TestInstantiationService());
		const service = store.add(instantiation.createInstance(NodeExtHostMpcService));
		assert.deepStrictEqual(service.mcpServerDefinitions, []);
	});

	test('rejects transport launch before accessing command, envFile, cwd or HTTP URL', async () => {
		const service = store.add(new NodeExtHostMpcService());
		const options = { get launch(): McpServerLaunch.Serialized { throw new Error('Must not read a Node MCP launch'); } };
		assert.throws(() => service.$startMcp(1, options), /MCP is not available/);
		await assert.rejects(service.startMcpGateway(), /MCP is not available/);
		service.$stopMcp(1);
		await service.$waitForInitialCollectionProviders();
	});
});
