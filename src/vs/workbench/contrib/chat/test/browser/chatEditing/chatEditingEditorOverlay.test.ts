/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatEditingEditorOverlay } from '../../../browser/chatEditing/chatEditingEditorOverlay.js';

suite('ChatEditingEditorOverlay disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not activate editor groups or create overlay controllers', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatEditingEditorOverlay));
	});
});
