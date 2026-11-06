/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatAgentRecommendation } from '../../browser/actions/chatAgentRecommendationActions.js';
import { AgentPluginRecommendations } from '../../browser/claudePluginRecommendations.js';

suite('Chat agent recommendations disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('creates recommendation contributions without services or installation commands', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const before = [...CommandsRegistry.getCommands().keys()].sort();
		store.add(instantiation.createInstance(ChatAgentRecommendation));
		store.add(instantiation.createInstance(AgentPluginRecommendations));
		assert.deepStrictEqual([...CommandsRegistry.getCommands().keys()].sort(), before);
	});
});
