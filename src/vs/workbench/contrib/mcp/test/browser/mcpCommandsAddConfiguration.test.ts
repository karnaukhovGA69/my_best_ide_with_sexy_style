/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { AddConfigurationType, AssistedTypes, McpAddConfigurationCommand, McpInstallFromManifestCommand } from '../../browser/mcpCommandsAddConfiguration.js';
import { IWorkspaceMcpConfigurationTarget } from '../../browser/mcpConfigurationDestination.js';

suite('MCP installation wizards removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	async function rejection(operation: Promise<void>): Promise<string> {
		return operation.then(() => 'Unexpected success', error => error instanceof Error ? error.message : String(error));
	}

	test('manual and assisted entry point rejects without resolving services or reading target', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const target = new Proxy(upcastPartial<IWorkspaceMcpConfigurationTarget>({}), { get() { throw new Error('Target read'); } });
		for (const destination of [undefined, target]) {
			const command = instantiation.createInstance(McpAddConfigurationCommand, destination);
			assert.strictEqual(await rejection(command.run()), 'MCP installation is disabled in Myself IDE.');
		}
	});

	test('manifest entry point rejects without file dialog, scanner or installation services', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const command = instantiation.createInstance(McpInstallFromManifestCommand);
		assert.strictEqual(await rejection(command.run()), 'MCP installation is disabled in Myself IDE.');
	});

	test('shared configuration key remains compatible', () => {
		assert.strictEqual(AssistedTypes[AddConfigurationType.NuGetPackage].enabledConfigKey, 'chat.mcp.assisted.nuget.enabled');
	});
});
