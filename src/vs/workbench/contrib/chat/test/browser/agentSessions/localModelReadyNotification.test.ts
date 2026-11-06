/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { LocalModelReadyNotificationContribution, registerLocalModelReadyOfferCommands } from '../../../browser/agentSessions/agentHost/localModelReadyNotification.js';

suite('LocalModelReadyNotification', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve model services or register ready-offer commands', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const before = [...CommandsRegistry.getCommands().keys()].sort();
		store.add(instantiation.createInstance(LocalModelReadyNotificationContribution));
		registerLocalModelReadyOfferCommands();
		registerLocalModelReadyOfferCommands();
		assert.deepStrictEqual([...CommandsRegistry.getCommands().keys()].sort(), before);
		for (const id of ['workbench.action.chat.localModel.newAutoChat', '_workbench.action.chat.localModel.readyOfferNotNow', '_workbench.action.chat.localModel.readyOfferLoad']) {
			assert.strictEqual(CommandsRegistry.getCommand(id), undefined);
		}
	});
});
