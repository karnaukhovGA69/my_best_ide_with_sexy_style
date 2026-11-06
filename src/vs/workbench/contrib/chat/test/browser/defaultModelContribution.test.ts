/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { InlineChatDefaultModel } from '../../../inlineChat/browser/inlineChatDefaultModel.js';
import { createDefaultModelArrays } from '../../browser/defaultModelContribution.js';
import { ExploreAgentDefaultModel } from '../../browser/exploreAgentDefaultModel.js';
import { PlanAgentDefaultModel } from '../../browser/planAgentDefaultModel.js';
import { UtilityModelContribution, UtilitySmallModelContribution } from '../../browser/utilityModelContribution.js';

suite('Static default model settings', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('creates all model contributions without resolving providers', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		for (const Contribution of [PlanAgentDefaultModel, ExploreAgentDefaultModel, InlineChatDefaultModel, UtilityModelContribution, UtilitySmallModelContribution]) {
			store.add(instantiation.createInstance(Contribution));
			assert.deepStrictEqual(Contribution.modelIds, ['']);
			assert.strictEqual(Contribution.modelLabels.length, 1);
			assert.strictEqual(Contribution.modelDescriptions.length, 1);
		}
	});

	test('retains independent default arrays and custom display labels', () => {
		const first = createDefaultModelArrays();
		const second = createDefaultModelArrays('Default', 'Original behavior');
		assert.deepStrictEqual(first, { modelIds: [''], modelLabels: ['Auto (Vendor Default)'], modelDescriptions: ['Use the vendor\'s default model'] });
		assert.deepStrictEqual(second, { modelIds: [''], modelLabels: ['Default'], modelDescriptions: ['Original behavior'] });
		assert.notStrictEqual(first.modelIds, second.modelIds);
	});
});
