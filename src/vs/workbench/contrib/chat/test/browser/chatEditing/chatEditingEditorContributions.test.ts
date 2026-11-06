/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatEditingEditorAccessibility } from '../../../browser/chatEditing/chatEditingEditorAccessibility.js';
import { ChatEditingEditorContextKeys } from '../../../browser/chatEditing/chatEditingEditorContextKeys.js';

suite('Chat editing editor contributions disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve editor groups or AI editing sessions', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatEditingEditorContextKeys));
	});

	test('does not resolve editors or accessibility signal services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatEditingEditorAccessibility));
	});
});
