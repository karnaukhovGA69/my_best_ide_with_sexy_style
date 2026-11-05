/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import '../../browser/mcp.contribution.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { IMcpRegistry } from '../../common/mcpRegistryTypes.js';
import { IMcpService } from '../../common/mcpTypes.js';
import { mcpDiscoveryRegistry } from '../../common/discovery/mcpDiscovery.js';

suite('Workbench - MCP - Discovery removed', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('loading the common contribution does not register discovery sources', () => {
		assert.deepStrictEqual(mcpDiscoveryRegistry.getAll(), []);
	});

	test('remaining MCP consumers retain their DI contracts', () => {
		const descriptors = getSingletonServiceDescriptors();
		assert.deepStrictEqual([IMcpRegistry, IMcpService].map(id => descriptors.some(([service]) => service === id)), [true, true]);
	});
});
