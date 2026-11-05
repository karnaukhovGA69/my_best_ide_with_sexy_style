/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { mainWindow } from '../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { TtsPlaybackService } from '../../../browser/voiceClient/ttsPlaybackService.js';

suite('TtsPlaybackService - unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let sandbox: sinon.SinonSandbox;

	setup(() => { sandbox = sinon.createSandbox(); });
	teardown(() => { sandbox.restore(); });

	function unreadableWindow(): Window & typeof globalThis {
		return new Proxy({} as Window & typeof globalThis, {
			get: (_target, key) => { throw new Error(`Unexpected window access: ${String(key)}`); }
		});
	}

	function assertInactive(service: TtsPlaybackService): void {
		assert.strictEqual(service.isPlaying, false);
		assert.strictEqual(service.analyserNode, undefined);
		assert.strictEqual(service.getLastPlayedSamples(), null);
	}

	function assertContextUnavailable(service: TtsPlaybackService, window: Window & typeof globalThis): void {
		let failure: unknown;
		try {
			service.ensureContext(window);
		} catch (error) {
			failure = error;
		}
		assert.ok(failure instanceof Error);
		assert.strictEqual(failure.message, 'Voice audio playback is unavailable in Myself IDE.');
	}

	test('constructs through strict DI without logging or audio services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		assertInactive(store.add(instantiationService.createInstance(TtsPlaybackService)));
	});

	test('refuses context creation without accessing the window', () => {
		const service = store.add(new TtsPlaybackService());
		assertContextUnavailable(service, unreadableWindow());
		assertInactive(service);
	});

	for (const { name, audio, isFinal } of [
		{ name: 'streaming chunk', audio: 'AAAA', isFinal: false },
		{ name: 'final chunk', audio: 'AAAA', isFinal: true },
		{ name: 'empty final marker', audio: '', isFinal: true },
		{ name: 'malformed audio', audio: '!not-base64!', isFinal: false },
	]) {
		test(`ignores ${name} without decoding or playback events`, async () => {
			const service = store.add(new TtsPlaybackService());
			let events = 0;
			store.add(service.onPlaybackStarted(() => events++));
			store.add(service.onPlaybackStopped(() => events++));
			service.playAudioChunk(audio, isFinal, unreadableWindow());
			await Promise.resolve();
			service.stopPlayback();
			service.closeContext();
			assert.strictEqual(events, 0);
			assertInactive(service);
		});
	}

	test('never creates AudioContext, decodes base64 or schedules playback', async () => {
		const clock = sandbox.useFakeTimers();
		const context = sandbox.stub(mainWindow, 'AudioContext').throws(new Error('Unexpected audio context'));
		const decode = sandbox.stub(mainWindow, 'atob').throws(new Error('Unexpected audio decode'));
		const service = store.add(new TtsPlaybackService());
		for (let i = 0; i < 2; i++) {
			assertContextUnavailable(service, mainWindow);
			service.playAudioChunk('AAAA', false, mainWindow);
			service.playAudioChunk('', true, mainWindow);
			service.stopPlayback();
			service.closeContext();
		}
		await clock.tickAsync(180_000);
		assert.strictEqual(clock.countTimers(), 0);
		assert.strictEqual(context.callCount, 0);
		assert.strictEqual(decode.callCount, 0);
		assertInactive(service);
	});

	test('disposal and later calls cannot restart playback or retain samples', () => {
		const service = store.add(new TtsPlaybackService());
		service.dispose();
		service.dispose();
		service.playAudioChunk('AAAA', true, unreadableWindow());
		service.stopPlayback();
		service.closeContext();
		assertContextUnavailable(service, unreadableWindow());
		assertInactive(service);
	});
});
