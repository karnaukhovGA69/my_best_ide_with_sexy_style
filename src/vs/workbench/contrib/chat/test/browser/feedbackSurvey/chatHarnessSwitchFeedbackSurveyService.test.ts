/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatHarnessSwitchFeedbackSurveyService, IChatHarnessSwitchFeedbackSurveyContext } from '../../../browser/feedbackSurvey/chatHarnessSwitchFeedbackSurveyService.js';

suite('Chat harness switch survey disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs and prompts without configuration, storage, telemetry or chat services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(ChatHarnessSwitchFeedbackSurveyService));
		const context = new Proxy({} as IChatHarnessSwitchFeedbackSurveyContext, { get: () => { throw new Error('Survey context must not be read'); } });
		assert.strictEqual(service.prompt(URI.parse('vscode-chat-input://test'), context), undefined);
		assert.strictEqual(service.prompt(URI.parse('vscode-chat-input://test'), context), undefined);
	});
});
