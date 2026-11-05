/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { McpDevModeDebugging } from '../../common/mcpDevMode.js';
import { McpServerDefinition, McpServerLaunch, McpServerTransportType } from '../../common/mcpTypes.js';

suite('Myself IDE disabled MCP development mode', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('debug service constructs without debugger or command dependencies', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.createInstance(McpDevModeDebugging);
	});

	test('explicit transform rejects HTTP, Node and Python requests without changing the launch', async () => {
		const service = new McpDevModeDebugging();
		const launches: McpServerLaunch[] = [
			{ type: McpServerTransportType.HTTP, uri: URI.parse('https://example.invalid/mcp'), headers: [] },
			...[ 'node', 'python' ].map(command => ({ type: McpServerTransportType.Stdio as const, command, args: ['fixture'], cwd: undefined, env: {}, envFile: undefined, sandbox: undefined })),
		];
		for (const launch of launches) {
			const definition = new Proxy(new class extends mock<McpServerDefinition>() { }, {
				get() { throw new Error('Must not inspect debug settings'); }
			});
			const before = JSON.stringify(launch);
			await service.transform(definition, launch).then(
				() => assert.fail('MCP debugging must reject'),
				error => {
					assert.ok(error instanceof Error);
					assert.match(error.message, /MCP debugging is not available/);
				}
			);
			assert.strictEqual(JSON.stringify(launch), before);
		}
	});
});
