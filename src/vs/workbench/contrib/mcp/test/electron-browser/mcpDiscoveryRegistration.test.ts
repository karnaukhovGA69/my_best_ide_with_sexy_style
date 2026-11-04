/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import '../../browser/mcp.contribution.js';
import '../../electron-browser/mcp.contribution.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { mcpDiscoveryRegistry } from '../../common/discovery/mcpDiscovery.js';
import { IWorkbenchMcpGatewayService } from '../../common/mcpGatewayService.js';
import { WorkbenchMcpGatewayService } from '../../electron-browser/mcpGatewayService.js';

suite('Workbench - MCP - Native discovery removed', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('loading desktop contributions does not register native or remote discovery', () => {
		assert.deepStrictEqual(mcpDiscoveryRegistry.getAll(), []);
	});

	test('desktop gateway registration remains available to existing callers', () => {
		const registrations = getSingletonServiceDescriptors().filter(([id]) => id === IWorkbenchMcpGatewayService);
		assert.strictEqual(registrations.at(-1)?.[1].ctor, WorkbenchMcpGatewayService);
	});
});
