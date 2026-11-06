/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatModelFeedbackSurveyService } from '../../../browser/feedbackSurvey/chatModelFeedbackSurveyService.js';
import type { IChatResponseViewModel } from '../../../common/model/chatViewModel.js';

suite('Model feedback surveys disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructs without experiments, storage, telemetry, commands or chat dependencies', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(ChatModelFeedbackSurveyService));
	});

	test('never reads responses, collects comments or emits survey state', () => {
		const service = store.add(new ChatModelFeedbackSurveyService());
		const response = new Proxy({} as IChatResponseViewModel, { get: () => { throw new Error('Response must not be read'); } });
		let events = 0;
		store.add(service.onDidChangeSurveyState(() => events++));
		store.add(service.onDidChangeConfiguration(() => events++));
		assert.strictEqual(service.getSurvey(response), undefined);
		service.toggle(response);
		service.notifyModelSwitchedAway(URI.parse('test://session'), 'old', 'new');
		service.answerChoice(response, 'step', 'option');
		service.setCommentDraft(response, 'private draft');
		service.submit(response, 'private comment');
		service.dismiss(response);
		assert.strictEqual(service.getSurvey(response), undefined);
		assert.strictEqual(events, 0);
	});
});
