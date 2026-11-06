/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatPromoNotificationContribution } from '../../browser/chatPromoNotification.js';

suite('ChatPromoNotificationContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve model, notification, or storage services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatPromoNotificationContribution));
	});
});
