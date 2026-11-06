/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { AgentPluginCommandsContribution } from '../../browser/agentPluginCommands.js';

suite('AgentPluginCommandsContribution disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve plugin services or register update commands', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(AgentPluginCommandsContribution));
		assert.strictEqual(CommandsRegistry.getCommand('workbench.agentPlugins.checkForUpdates'), undefined);
		assert.strictEqual(CommandsRegistry.getCommand('workbench.agentPlugins.forceUpdate'), undefined);
	});
});
