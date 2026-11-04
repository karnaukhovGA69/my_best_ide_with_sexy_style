/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../instantiation/common/descriptors.js';
import { InstantiationService } from '../../../instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../instantiation/common/serviceCollection.js';
import { ILogger } from '../../../log/common/log.js';
import { IMcpManagementService } from '../../common/mcpManagement.js';
import { McpManagementCli } from '../../common/mcpManagementCli.js';

suite('McpManagementCli', () => {
	const ds = ensureNoDisposablesAreLeakedInTestSuite();
	const disabled = { message: 'MCP is not available in this IDE.' };
	const logger = new Proxy({} as ILogger, {
		get: () => { throw new Error('Unexpected logger access'); },
	});

	test('rejects through the existing CLI call shape without a management service', async () => {
		const insta = ds.add(new InstantiationService(new ServiceCollection(), true));
		await assert.rejects(insta.createInstance(McpManagementCli, logger).addMcpDefinitions([]), disabled);
	});

	test('does not instantiate a registered management service', async () => {
		class UnexpectedMcpManagementService extends mock<IMcpManagementService>() {
			constructor() {
				super();
				throw new Error('Unexpected MCP management service construction');
			}
		}
		const insta = ds.add(new InstantiationService(new ServiceCollection([
			IMcpManagementService, new SyncDescriptor(UnexpectedMcpManagementService),
		]), true));
		const cli = insta.createInstance(McpManagementCli, logger);
		await assert.rejects(cli.addMcpDefinitions(['{"name":"test","command":"test-command"}']), disabled);
	});

	test('rejects valid and malformed batches without installing or logging input', async () => {
		const service = new Proxy({} as IMcpManagementService, {
			get: () => { throw new Error('Unexpected MCP management service access'); },
		});
		const insta = ds.add(new InstantiationService(new ServiceCollection([IMcpManagementService, service]), true));
		const cli = insta.createInstance(McpManagementCli, logger);
		const stdio = JSON.stringify({ name: 'test-stdio', command: 'test-command', env: { TEST_TOKEN: 'synthetic-secret' } });
		const http = JSON.stringify({ name: 'test-http', url: 'https://example.invalid/mcp', headers: { Authorization: 'synthetic-secret' } });
		for (const definitions of [[], [stdio], [http], [stdio, http], ['invalid synthetic-secret JSON'], ['null'], ['{}'], [stdio, 'invalid JSON']]) {
			await assert.rejects(cli.addMcpDefinitions(definitions), disabled);
		}
	});

	test('rejects before reading the definitions array', async () => {
		const service = new Proxy({} as IMcpManagementService, {
			get: () => { throw new Error('Unexpected MCP management service access'); },
		});
		const insta = ds.add(new InstantiationService(new ServiceCollection([IMcpManagementService, service]), true));
		const definitions = new Proxy<string[]>([], {
			get: () => { throw new Error('Unexpected definitions access'); },
		});
		await assert.rejects(insta.createInstance(McpManagementCli, logger).addMcpDefinitions(definitions), disabled);
	});
});
