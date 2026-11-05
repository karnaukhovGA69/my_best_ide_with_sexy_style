/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Action } from '../../../../../base/common/actions.js';
import { autorun } from '../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpression, ContextKeyValue, IContext } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { AGENTS_VOICE_CONNECTED, AGENTS_VOICE_ENTITLED } from '../../../agentsVoice/common/agentsVoice.js';
import { IVoiceInputModeService, VoiceInputModeService } from '../../browser/voiceInputMode/voiceInputMode.js';
import { ChatVoiceInputModeAction, ChatVoiceInputModeToggleListenAction, IVoiceInputModePillOptions, isVoiceInputModeAvailable, registerVoiceInputModeSimulateActions, VoiceInputModeActionViewItem } from '../../browser/voiceInputMode/voiceInputModeActionViewItem.js';
import { SegmentedVoiceInputModePillActive, SegmentedVoiceInputModePillInactive } from '../../browser/voiceInputMode/voiceInputModeContextKeys.js';
import { ChatContextKeys } from '../../common/actions/chatContextKeys.js';

suite('Voice input mode unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('shows the segmented pill only when it has multiple active controls', () => {
		const values: Record<string, ContextKeyValue> = {
			[ChatContextKeys.enabled.key]: true,
			[AGENTS_VOICE_ENTITLED.key]: true,
			[ChatContextKeys.speechToTextConfigured.key]: true,
			'config.agents.voice.enabled': true,
			'config.agents.voice.showButton': true,
			'config.dictation.showButton': true,
			'config.agents.voice.handsFree': true,
			[AGENTS_VOICE_CONNECTED.key]: false,
		};
		const matches = (expression: ContextKeyExpression) => expression.evaluate({
			getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T,
		});

		assert.strictEqual(matches(SegmentedVoiceInputModePillActive), true);
		assert.strictEqual(matches(SegmentedVoiceInputModePillInactive), false);

		values[ChatContextKeys.speechToTextConfigured.key] = false;
		assert.strictEqual(matches(SegmentedVoiceInputModePillActive), false);
		assert.strictEqual(matches(SegmentedVoiceInputModePillInactive), true);

		values[AGENTS_VOICE_CONNECTED.key] = true;
		assert.strictEqual(matches(SegmentedVoiceInputModePillActive), true);
		assert.strictEqual(matches(SegmentedVoiceInputModePillInactive), false);
	});
	test('strict DI service has fixed unavailable observables and schedules no walkthroughs', async () => {
		const sandbox = sinon.createSandbox();
		const timers = sandbox.useFakeTimers();
		try {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			const service = store.add(instantiation.createInstance(VoiceInputModeService));
			let observations = 0;
			store.add(autorun(reader => {
				observations++;
				assert.strictEqual(service.selectedMode.read(reader), 'voice');
				assert.strictEqual(service.voiceAvailable.read(reader), false);
				assert.strictEqual(service.dictationAvailable.read(reader), false);
				assert.strictEqual(service.handsFree.read(reader), false);
				assert.strictEqual(service.simulatedVoiceState.read(reader), undefined);
				assert.strictEqual(service.simulatedHandsFree.read(reader), undefined);
				assert.strictEqual(service.simulatedVersion.read(reader), undefined);
				assert.strictEqual(service.simulatedHover.read(reader), false);
			}));
			for (const version of ['handsFree', 'keyboardHold', 'buttonHold', 'clickToggle'] as const) {
				service.setSelectedMode('dictation');
				service.setSimulatedVoiceState('speaking');
				service.startVoiceStateWalkthrough(version);
				service.stepVoiceStateWalkthrough();
				await timers.tickAsync(30000);
				service.clearSimulation();
			}
			assert.strictEqual(observations, 1);
			assert.strictEqual(timers.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('actions are unavailable and simulation registration does not add commands', async () => {
		const commands = Array.from(CommandsRegistry.getCommands().keys());
		registerVoiceInputModeSimulateActions();
		assert.deepStrictEqual(Array.from(CommandsRegistry.getCommands().keys()), commands);
		const unreadable = { get: () => { throw new Error('Services must not be read'); } };
		const accessor = new Proxy({} as ServicesAccessor, unreadable);
		const context = new Proxy({} as IContext, unreadable);
		for (const action of [new ChatVoiceInputModeAction(), new ChatVoiceInputModeToggleListenAction()]) {
			assert.strictEqual(action.desc.precondition?.evaluate(context), false);
			assert.strictEqual(action.desc.menu, undefined);
			assert.strictEqual(action.desc.keybinding, undefined);
			assert.strictEqual(action.desc.f1, false);
			await action.run(accessor);
		}
		assert.strictEqual(isVoiceInputModeAvailable(new Proxy({} as IVoiceInputModeService, unreadable)), undefined);
	});

	test('direct view construction preserves DOM, ignores host hooks and cannot execute the action', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		let runs = 0;
		const action = store.add(new Action('voice.test', 'Voice', undefined, true, async () => { runs++; }));
		const options = new Proxy({} as IVoiceInputModePillOptions, { get: () => { throw new Error('Host options must not be read'); } });
		const view = store.add(instantiation.createInstance(VoiceInputModeActionViewItem, action, options));
		const container = document.createElement('div');
		container.innerHTML = '<input aria-label="Existing input">';
		const original = container.outerHTML;
		view.render(container);
		view.onClick();
		view.focus();
		view.blur();
		container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		assert.strictEqual(view.isEnabled(), false);
		assert.strictEqual(runs, 0);
		assert.strictEqual(container.outerHTML, original);
		view.dispose();
		assert.strictEqual(container.outerHTML, original);
	});
});
