/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { onboardingScenarioRegistry } from '../../../../onboarding/common/onboardingRegistry.js';
import { MODEL_PICKER_TRYOUT_ID } from '../../../common/onboarding/modelPickerTryout.js';
import '../../../browser/onboarding/modelPickerTryout.contribution.js';

suite('Model picker tryout disabled', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('does not register a model/provider onboarding scenario or descriptor', () => {
		assert.strictEqual(onboardingScenarioRegistry.getScenario(MODEL_PICKER_TRYOUT_ID), undefined);
		assert.strictEqual(onboardingScenarioRegistry.getScenarioDescriptors().some(item => item.id === MODEL_PICKER_TRYOUT_ID), false);
	});
});
