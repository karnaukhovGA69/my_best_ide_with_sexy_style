/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatModelFeedbackSurveyWidget } from '../../../browser/feedbackSurvey/chatModelFeedbackSurveyWidget.js';
import type { IChatResponseViewModel } from '../../../common/model/chatViewModel.js';

suite('Model feedback survey widget disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('hides its empty container without survey, context key or hover dependencies', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const container = mainWindow.document.createElement('div');
		const widget = store.add(instantiation.createInstance(ChatModelFeedbackSurveyWidget, container, () => { throw new Error('Focus must not change'); }));
		const response = new Proxy({} as IChatResponseViewModel, { get: () => { throw new Error('Response must not be read'); } });
		widget.render(response);
		widget.render(undefined);
		widget.dispose();
		assert.strictEqual(container.hidden, true);
		assert.strictEqual(container.childElementCount, 0);
	});

	test('does not intercept keyboard navigation', () => {
		const container = mainWindow.document.createElement('div');
		store.add(new ChatModelFeedbackSurveyWidget(container, () => {}));
		for (const key of ['Escape', 'Enter', 'ArrowDown']) {
			const event = new mainWindow.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			assert.strictEqual(container.dispatchEvent(event), true);
			assert.strictEqual(event.defaultPrevented, false);
		}
	});
});
