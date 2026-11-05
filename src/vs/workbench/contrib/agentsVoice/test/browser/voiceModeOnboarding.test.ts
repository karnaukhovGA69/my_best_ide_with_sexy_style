/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Context } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { AGENTS_VOICE_ENABLED, getAgentsVoicePolicyValue } from '../../common/agentsVoice.js';
import { IVoiceModeOnboardingBannerOptions, VoiceModeOnboardingBanner, VoiceModeOnboardingService } from '../../browser/voiceModeOnboarding.js';
import { IChatInputOnboardingHostOptions } from '../../../chat/browser/widget/input/chatInputOnboarding.js';

suite('Voice onboarding unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function unreadable<T extends object>(): T {
		return new Proxy({} as T, { get: () => { throw new Error('Unexpected host/options access'); } });
	}

	test('constructs service and banner through strict DI with no other services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(VoiceModeOnboardingService));
		store.add(instantiation.createInstance(VoiceModeOnboardingBanner, unreadable<IVoiceModeOnboardingBannerOptions>()));
		assert.strictEqual(service.isVisible, false);
	});

	test('does not register hosts or show an introduction', () => {
		const service = store.add(new VoiceModeOnboardingService());
		store.add(service.registerHost(unreadable<IChatInputOnboardingHostOptions>()));
		service.showIfNeeded();
		assert.strictEqual(service.show(), false);
		service.dispose();
		assert.strictEqual(service.show(), false);
		store.add(service.registerHost(unreadable<IChatInputOnboardingHostOptions>()));
		assert.strictEqual(service.isVisible, false);
	});

	test('direct banner construction creates no DOM, media, device requests or timers', async () => {
		const sandbox = sinon.createSandbox();
		try {
			const clock = sandbox.useFakeTimers();
			const audio = sandbox.stub(mainWindow, 'Audio').throws(new Error('Unexpected audio'));
			const enumerate = sandbox.stub(mainWindow.navigator.mediaDevices, 'enumerateDevices').rejects(new Error('Unexpected devices'));
			const capture = sandbox.stub(mainWindow.navigator.mediaDevices, 'getUserMedia').rejects(new Error('Unexpected capture'));
			const container = document.createElement('div');
			const original = document.createElement('span');
			container.appendChild(original);
			const banner = store.add(new VoiceModeOnboardingBanner({
				container, source: 'manual',
				onDismiss: () => assert.fail('Unexpected dismiss'),
				audioFactory: () => { throw new Error('Unexpected audio factory'); }
			}));
			banner.focus();
			banner.announce();
			banner.setVisible(true);
			banner.setVisible(false);
			assert.strictEqual(banner.hasFocus(), false);
			assert.strictEqual(banner.canFocus(), false);
			banner.dispose();
			await clock.tickAsync(60_000);
			assert.strictEqual(container.childNodes.length, 1);
			assert.strictEqual(container.firstChild, original);
			assert.strictEqual(audio.callCount, 0);
			assert.strictEqual(enumerate.callCount, 0);
			assert.strictEqual(capture.callCount, 0);
			assert.strictEqual(clock.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('disables Voice Mode when preview features are disabled by policy', () => {
		assert.deepStrictEqual([
			getAgentsVoicePolicyValue({ chat_preview_features_enabled: false }),
			getAgentsVoicePolicyValue({ chat_preview_features_enabled: true }),
			getAgentsVoicePolicyValue({}),
		], [
			false,
			undefined,
			undefined,
		]);
	});

	test('exposes BYOK voice controls without paid entitlement while preserving AI and voice gates', () => {
		const cases = [
			{ ai: true, voice: true, entitled: false, model: 'gpt-live-1' },
			{ ai: true, voice: true, entitled: false, model: '  ' },
			{ ai: true, voice: true, entitled: true, model: '' },
			{ ai: false, voice: true, entitled: false, model: 'gpt-live-1' },
			{ ai: true, voice: false, entitled: false, model: 'gpt-live-1' },
		];
		assert.deepStrictEqual(cases.map(({ ai, voice, entitled, model }) => {
			const values: Record<string, string | boolean> = {
				'chatIsEnabled': ai,
				'config.agents.voice.enabled': voice,
				'agentsVoiceEntitled': entitled,
				'config.agents.voice.useBYOKVoiceModel': model,
			};
			const context = new Context(0, null);
			for (const [key, value] of Object.entries(values)) {
				context.setValue(key, value);
			}
			return AGENTS_VOICE_ENABLED.evaluate(context);
		}), [true, false, true, false, false]);
	});

});
