/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IMcpSandboxConfiguration } from '../../../../../platform/mcp/common/mcpPlatformTypes.js';
import { McpSandboxService } from '../../common/mcpSandboxService.js';
import { McpServerDefinition, McpServerLaunch, McpServerTransportType } from '../../common/mcpTypes.js';

suite('MCP Sandbox Service - launch removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('startup and disposal require no file, remote, scanner or environment services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(McpSandboxService));
		service.dispose();
		service.dispose();
	});

	for (const remoteAuthority of [undefined, 'test-remote']) {
		for (const sandboxEnabled of [false, true]) {
			test(`refuses stdio and HTTP launches, remote=${!!remoteAuthority}, sandbox=${sandboxEnabled}`, async () => {
				const service = store.add(new McpSandboxService());
				const definition = upcastPartial<McpServerDefinition>({ id: 'test-server', label: 'Test server', sandboxEnabled });
				const launches: McpServerLaunch[] = [
					{ type: McpServerTransportType.Stdio, command: 'test-command', args: [], env: {}, cwd: undefined, envFile: undefined, sandbox: undefined },
					{ type: McpServerTransportType.HTTP, uri: URI.parse('https://example.invalid/mcp'), headers: [] },
				];
				for (const launch of launches) {
					const outcome = await service.launchInSandboxIfEnabled(definition, launch, remoteAuthority, ConfigurationTarget.USER).then(
						() => 'Unexpected launch returned',
						error => error instanceof Error ? error.message : String(error),
					);
					assert.strictEqual(outcome, 'MCP server launches are disabled in Myself IDE.');
				}
			});
		}
	}

	test('refuses launch before reading the definition or transport', async () => {
		const service = store.add(new McpSandboxService());
		const definition = upcastPartial<McpServerDefinition>({ get sandboxEnabled(): never { throw new Error('Definition read'); } });
		const launch = upcastPartial<McpServerLaunch>({ get type(): never { throw new Error('Transport read'); } });
		const outcome = await service.launchInSandboxIfEnabled(definition, launch, undefined, ConfigurationTarget.WORKSPACE).then(
			() => 'Unexpected launch returned', error => error instanceof Error ? error.message : String(error),
		);
		assert.strictEqual(outcome, 'MCP server launches are disabled in Myself IDE.');
	});

	test('does not advertise sandbox support, suggest permissions or apply configuration changes', async () => {
		const service = store.add(new McpSandboxService());
		const definition = upcastPartial<McpServerDefinition>({
			get sandboxEnabled(): never { throw new Error('Definition read'); },
			get label(): never { throw new Error('Label read'); },
		});
		const sandbox: IMcpSandboxConfiguration = {
			get network(): never { throw new Error('Network permissions read'); },
			get filesystem(): never { throw new Error('Filesystem permissions read'); },
		};
		const resource = URI.from({ scheme: 'inmemory', path: '/mcp.json' });
		const applied = [];
		for (const target of [ConfigurationTarget.USER, ConfigurationTarget.USER_REMOTE, ConfigurationTarget.WORKSPACE, ConfigurationTarget.WORKSPACE_FOLDER]) {
			applied.push(await service.applySandboxConfigSuggestion(definition, resource, target, [], sandbox));
		}
		assert.deepStrictEqual({
			local: await service.isEnabled(definition), remote: await service.isEnabled(definition, 'test-remote'),
			suggestion: service.getSandboxConfigSuggestionMessage('Test server', [{ kind: 'network', host: 'example.invalid', message: 'Test block' }], sandbox),
			applied,
		}, { local: false, remote: false, suggestion: undefined, applied: [false, false, false, false] });
	});
});
