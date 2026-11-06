/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatExpNotificationContribution } from '../../../browser/expNotification/chatExpNotificationContribution.js';

suite('ChatExpNotification', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve assignments, notifications, sessions, or user storage', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatExpNotificationContribution));
	});
});
