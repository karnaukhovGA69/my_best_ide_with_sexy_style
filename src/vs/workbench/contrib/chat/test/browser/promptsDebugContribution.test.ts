/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { PromptsDebugContribution } from '../../browser/promptsDebugContribution.js';

suite('PromptsDebugContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not resolve prompts, agents, sessions, debug events, or log services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(PromptsDebugContribution));
	});
});
