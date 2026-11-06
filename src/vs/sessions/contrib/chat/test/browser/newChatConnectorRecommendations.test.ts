/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { NewChatConnectorRecommendations } from '../../browser/newChatConnectorRecommendations.js';

suite('Session connector tips disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not inspect input, subscribe, choose recommendations or require services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const fail = () => { throw new Error('Input and random sources must not be used'); };
		const provider = store.add(instantiation.createInstance(NewChatConnectorRecommendations, { getInputValue: fail, onDidChangeInputValue: fail }, fail));
		let events = 0;
		store.add(provider.onDidChange(() => events++));
		assert.strictEqual(provider.provideTip(), undefined);
		assert.strictEqual(provider.hasMultipleTips(), false);
		assert.strictEqual(provider.navigateTip(1), undefined);
		assert.strictEqual(provider.navigateTip(-1), undefined);
		provider.dismissTip('connectorRecommendation.test');
		assert.strictEqual(events, 0);
	});
});
