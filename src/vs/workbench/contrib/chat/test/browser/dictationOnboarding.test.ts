/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { buildMicrophoneOptions, DictationOnboardingBanner, DictationOnboardingService, IDictationOnboardingBannerOptions, indexOfMicrophone } from '../../browser/speechToText/dictationOnboarding.js';
import { IChatInputOnboardingHostOptions } from '../../browser/widget/input/chatInputOnboarding.js';

function device(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
	return { kind, deviceId, label, groupId: '', toJSON: () => ({}) };
}

suite('Dictation onboarding unavailable', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('labels the physical default microphone without listing it twice', () => {
		const options = buildMicrophoneOptions([
			// The virtual entries duplicate a real device under a synthetic id.
			device('audioinput', 'default', 'Default - Studio Mic'),
			device('audioinput', 'communications', 'Communications - Studio Mic'),
			device('audioinput', 'mic-a', 'Studio Mic'),
			// Same device reported twice, and a device that is not a microphone.
			device('audioinput', 'mic-a', 'Studio Mic'),
			device('audiooutput', 'speaker-a', 'Speakers'),
			// Labels stay empty until permission has been granted at least once.
			device('audioinput', 'abcdefghij-unlabelled', ''),
		]);

		assert.deepStrictEqual(options, [
			{ deviceId: '', label: 'Studio Mic (System default)' },
			{ deviceId: 'abcdefghij-unlabelled', label: 'Unknown device (abcdefgh)' },
		]);
	});

	test('uses the first physical microphone when the virtual default has no identity', () => {
		const options = buildMicrophoneOptions([
			device('audioinput', 'default', 'System default'),
			device('audioinput', 'mic-a', 'Studio Mic'),
			device('audioinput', 'mic-b', 'Built-in Mic'),
		]);

		assert.deepStrictEqual(options, [
			{ deviceId: '', label: 'Studio Mic (System default)' },
			{ deviceId: 'mic-b', label: 'Built-in Mic' },
		]);
	});

	test('falls back to the system default when the remembered device is gone', () => {
		const options = buildMicrophoneOptions([
			device('audioinput', 'default', 'Default - Built-in Mic'),
			device('audioinput', 'built-in', 'Built-in Mic'),
			device('audioinput', 'mic-a', 'Studio Mic'),
		]);

		assert.deepStrictEqual(
			{
				remembered: indexOfMicrophone(options, 'mic-a'),
				systemDefault: indexOfMicrophone(options, ''),
				unplugged: indexOfMicrophone(options, 'mic-that-was-unplugged'),
			},
			{ remembered: 1, systemDefault: 0, unplugged: 0 });
	});

	test('service needs no dependencies and never registers or displays a host', () => {
		const instantiation = disposables.add(new InstantiationService(new ServiceCollection(), true));
		const service = disposables.add(instantiation.createInstance(DictationOnboardingService));
		const host = new Proxy({} as IChatInputOnboardingHostOptions, { get: () => { throw new Error('Host must not be read'); } });
		assert.strictEqual(service.registerHost(host), Disposable.None);
		for (let i = 0; i < 2; i++) {
			assert.strictEqual(service.showIfNeeded(), false);
			assert.strictEqual(service.show(), false);
			service.refreshMicrophones();
			service.reset();
			assert.strictEqual(service.isVisible, false);
			service.dispose();
		}
	});

	test('direct banner construction ignores options and media devices without service dependencies', async () => {
		const instantiation = disposables.add(new InstantiationService(new ServiceCollection(), true));
		const options = new Proxy({} as IDictationOnboardingBannerOptions, { get: () => { throw new Error('Options must not be read'); } });
		const mediaDevices = new Proxy({} as MediaDevices, { get: () => { throw new Error('Devices must not be read'); } });
		const banner = disposables.add(instantiation.createInstance(DictationOnboardingBanner, options, mediaDevices));
		const analyser = new Proxy({} as AnalyserNode, { get: () => { throw new Error('Analyser must not be read'); } });
		await banner.refreshMicrophones(analyser, async () => { throw new Error('Microphone must not be switched'); });
		assert.strictEqual(banner.hasFocus(), false);
		assert.strictEqual(banner.canFocus(), false);
	});

	test('manual preview and automatic banners leave DOM, devices and timers untouched', async () => {
		const sandbox = sinon.createSandbox();
		const timers = sandbox.useFakeTimers();
		try {
			const container = document.createElement('div');
			container.innerHTML = '<input aria-label="Existing input">';
			const original = container.innerHTML;
			const mediaDevices = Object.assign(new EventTarget(), {
				enumerateDevices: sandbox.stub().resolves([]),
				getUserMedia: sandbox.stub().rejects(new Error('Unexpected microphone capture')),
			});
			const listener = sandbox.spy(mediaDevices, 'addEventListener');
			const dismiss = sandbox.spy();
			const switchMicrophone = sandbox.stub().resolves(undefined);
			for (const previewMicrophone of [true, false]) {
				const banner = disposables.add(new DictationOnboardingBanner({ container, onDismiss: dismiss, previewMicrophone, source: previewMicrophone ? 'manual' : 'automatic' }, mediaDevices));
				banner.setVisible(true);
				banner.focus();
				banner.announce();
				await banner.refreshMicrophones(undefined, switchMicrophone);
				banner.setVisible(false);
				banner.dispose();
				await banner.refreshMicrophones();
			}
			await timers.tickAsync(5000);
			assert.strictEqual(container.innerHTML, original);
			assert.strictEqual(timers.countTimers(), 0);
			for (const spy of [mediaDevices.getUserMedia, mediaDevices.enumerateDevices, listener, dismiss, switchMicrophone]) {
				assert.strictEqual(spy.callCount, 0);
			}
		} finally {
			sandbox.restore();
		}
	});
});
