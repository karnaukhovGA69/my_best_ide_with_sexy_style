/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IAgentSubscription } from '../../../../../../platform/agentHost/common/state/agentSubscription.js';
import { SessionState } from '../../../../../../platform/agentHost/common/state/sessionState.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { AgentHostPromptCacheNotification } from '../../../browser/agentSessions/agentHost/agentHostPromptCacheNotification.js';

suite('AgentHostPromptCacheNotification', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not read sessions, resolve services, or register notification commands', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const before = [...CommandsRegistry.getCommands().keys()].sort();
		const notification = store.add(instantiation.createInstance(AgentHostPromptCacheNotification));
		const unreadable = { get() { throw new Error('Notification must not read session data'); } };
		const resource = new Proxy({} as URI, unreadable);
		const subscription = new Proxy({} as IAgentSubscription<SessionState>, unreadable);
		const first = notification.trackSession(resource, subscription);
		const second = notification.trackSession(resource, subscription);
		first.dispose();
		second.dispose();
		assert.deepStrictEqual([...CommandsRegistry.getCommands().keys()].sort(), before);
	});
});
