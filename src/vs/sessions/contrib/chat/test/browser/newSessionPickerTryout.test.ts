/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { onboardingTryoutPresentationRegistry } from '../../../../../workbench/contrib/onboarding/common/onboardingTryout.js';
import '../../browser/newSessionPickerTryout.js';

suite('Session picker tryout disabled', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('does not register the presentation that opens an Agents draft', () => {
		assert.strictEqual(onboardingTryoutPresentationRegistry.get('newSessionPicker'), undefined);
	});
});
