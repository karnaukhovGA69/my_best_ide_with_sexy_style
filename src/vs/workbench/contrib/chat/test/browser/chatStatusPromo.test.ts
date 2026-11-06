/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatStatusPromo } from '../../browser/chatStatus/chatStatusPromo.js';

suite('ChatStatusPromo', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve services, expose offers, or register the promotional command', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		assert.strictEqual(CommandsRegistry.getCommand('_chat.tryPromoModel'), undefined);
		const promo = store.add(instantiation.createInstance(ChatStatusPromo));
		let changes = 0;
		store.add(promo.onDidChange(() => changes++));
		for (const visible of [true, false, true]) {
			assert.strictEqual(promo.getEntryProps(visible), undefined);
		}
		assert.strictEqual(CommandsRegistry.getCommand('_chat.tryPromoModel'), undefined);
		assert.strictEqual(changes, 0);
	});
});
