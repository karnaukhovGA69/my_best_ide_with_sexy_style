/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AgentsVoiceWidget, VoiceWidgetCallbacks, VoiceWidgetOptions } from '../../browser/agentsVoiceWidget.js';
import { bindWidgetToController, IWidgetBindingServices } from '../../browser/agentsVoiceWidgetBinding.js';

suite('Voice widget and binding unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function unreadable<T extends object>(): T {
		return new Proxy({} as T, { get: () => { throw new Error('Unexpected host, data or callback access'); } });
	}

	test('construction does not read container, callbacks or options', () => {
		store.add(new AgentsVoiceWidget(unreadable<HTMLElement>(), unreadable<VoiceWidgetCallbacks>(), unreadable<VoiceWidgetOptions>()));
	});

	test('setters never render UI or create animations, feedback or callback effects', async () => {
		const sandbox = sinon.createSandbox();
		try {
			const clock = sandbox.useFakeTimers();
			const frames = sandbox.stub(mainWindow, 'requestAnimationFrame').throws(new Error('Unexpected animation'));
			const container = document.createElement('div');
			const original = document.createElement('span');
			container.appendChild(original);
			const widget = store.add(new AgentsVoiceWidget(container, unreadable<VoiceWidgetCallbacks>(), { showOnboarding: true, focusable: true, inputBoxLayout: true }));
			widget.setConnected(true);
			widget.setConnecting(true);
			widget.setReconnecting(true);
			widget.setMuted(true);
			widget.setVoiceState('listening');
			widget.setStatusCounts(1, 1, 1);
			widget.setPendingToolConfirmations(unreadable());
			widget.setSpeakingSession(unreadable(), 'test');
			widget.setSessions(unreadable());
			widget.setSelectedTargetSession(unreadable());
			widget.setSessionGroups(unreadable());
			widget.setPttKeyLabel('test');
			widget.setTranscriptTurns(unreadable());
			widget.setStatusText('test');
			widget.setPopoutAvailable(true);
			widget.dismissOnboarding();
			widget.dispose();
			await clock.tickAsync(60_000);
			assert.strictEqual(container.childNodes.length, 1);
			assert.strictEqual(container.firstChild, original);
			assert.strictEqual(frames.callCount, 0);
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('binding does not read services, observe sessions or call widget methods', () => {
		const binding = store.add(bindWidgetToController(unreadable<AgentsVoiceWidget>(), unreadable<IWidgetBindingServices>()));
		binding.dispose();
		binding.dispose();
	});

	test('setters remain inactive after repeated disposal', () => {
		const widget = store.add(new AgentsVoiceWidget(unreadable(), unreadable()));
		widget.dispose();
		widget.dispose();
		widget.setConnected(true);
		widget.setTranscriptTurns(unreadable());
		widget.dismissOnboarding();
		store.add(bindWidgetToController(widget, unreadable()));
	});
});
