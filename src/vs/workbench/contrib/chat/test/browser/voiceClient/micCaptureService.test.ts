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
import { getMediaCaptureWindow, isMicrophonePermissionDeniedError, MIC_CAPTURE_CHUNK_SIZE, MicCaptureService } from '../../../browser/voiceClient/micCaptureService.js';

suite('MicCaptureService - unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let sandbox: sinon.SinonSandbox;
	let acquire: sinon.SinonStub;
	let audioContext: sinon.SinonStub;

	setup(() => {
		sandbox = sinon.createSandbox();
		acquire = sandbox.stub(mainWindow.navigator.mediaDevices, 'getUserMedia').rejects(new Error('Unexpected microphone access'));
		audioContext = sandbox.stub(mainWindow, 'AudioContext').throws(new Error('Unexpected audio context'));
	});
	teardown(() => { sandbox.restore(); });

	function unreadableWindow(): Window & typeof globalThis {
		return new Proxy({} as Window & typeof globalThis, {
			get: (_target, key) => { throw new Error(`Unexpected window access: ${String(key)}`); }
		});
	}

	function assertInactive(service: MicCaptureService): void {
		assert.strictEqual(service.isCapturing, false);
		assert.strictEqual(service.analyserNode, undefined);
		assert.strictEqual(service.mediaStream, undefined);
		assert.strictEqual(acquire.callCount, 0);
		assert.strictEqual(audioContext.callCount, 0);
	}

	async function assertUnavailable(operation: Promise<void>): Promise<void> {
		let failure: unknown;
		try {
			await operation;
		} catch (error) {
			failure = error;
		}
		assert.ok(failure instanceof Error);
		assert.strictEqual(failure.message, 'Voice microphone capture is unavailable in Myself IDE.');
		assert.strictEqual(isMicrophonePermissionDeniedError(failure), false);
	}

	test('constructs through strict DI without storage, notification or logging services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		assertInactive(store.add(instantiationService.createInstance(MicCaptureService)));
	});

	test('refuses direct and concurrent capture without inspecting the window', async () => {
		const service = store.add(new MicCaptureService());
		const window = unreadableWindow();
		service.prepare(window);
		await Promise.all([assertUnavailable(service.startCapture(window)), assertUnavailable(service.startCapture(window))]);
		service.stopCapture();
		await assertUnavailable(service.startCapture(window));
		assertInactive(service);
	});

	for (const passive of [false, true]) {
		test(`refuses push-to-talk with passive=${passive} before and after prepare`, async () => {
			const service = store.add(new MicCaptureService());
			await assertUnavailable(service.pttDown('test-turn', passive));
			service.prepare(unreadableWindow());
			await assertUnavailable(service.pttDown('test-turn', passive));
			service.pttUp();
			service.abortPtt();
			assertInactive(service);
		});
	}

	test('never acquires a real microphone, AudioContext, worklet or diagnostic timer', async () => {
		const clock = sandbox.useFakeTimers();
		const worklet = sandbox.stub(mainWindow, 'AudioWorkletNode').throws(new Error('Unexpected worklet'));
		const service = store.add(new MicCaptureService());
		service.prepare(mainWindow);
		await assertUnavailable(service.startCapture(mainWindow));
		await assertUnavailable(service.pttDown('test-turn'));
		service.pttUp();
		service.abortPtt();
		service.stopCapture();
		await clock.tickAsync(120_000);
		assert.strictEqual(clock.countTimers(), 0);
		assert.strictEqual(worklet.callCount, 0);
		assertInactive(service);
	});

	test('mute, suppression and release never emit audio or per-press diagnostics', async () => {
		const service = store.add(new MicCaptureService());
		let events = 0;
		store.add(service.onPttStart(() => events++));
		store.add(service.onPttAudioChunk(() => events++));
		store.add(service.onPttEnd(() => events++));
		store.add(service.onPttDiagnostic(() => events++));
		for (const muted of [true, false]) {
			service.isMuted = muted;
			service.suppressUntil(Number.MAX_SAFE_INTEGER);
			await assertUnavailable(service.pttDown('test-turn'));
			service.pttUp();
			service.abortPtt();
			service.stopCapture();
			assertInactive(service);
		}
		assert.strictEqual(events, 0);
	});

	test('repeated disposal and later requests cannot enable capture', async () => {
		const service = store.add(new MicCaptureService());
		service.dispose();
		service.dispose();
		service.prepare(unreadableWindow());
		await assertUnavailable(service.startCapture(unreadableWindow()));
		await assertUnavailable(service.pttDown('test-turn'));
		service.pttUp();
		service.stopCapture();
		assertInactive(service);
	});

	test('buffers 32 ms voice chunks at 16 kHz', () => {
		assert.deepStrictEqual({
			samples: MIC_CAPTURE_CHUNK_SIZE,
			durationMs: MIC_CAPTURE_CHUNK_SIZE / 16,
		}, {
			samples: 512,
			durationMs: 32,
		});
	});

	test('preserves media window selection without reading the supplied window', () => {
		assert.strictEqual(getMediaCaptureWindow(mainWindow), mainWindow);
		assert.strictEqual(getMediaCaptureWindow(unreadableWindow()), mainWindow);
	});

	test('distinguishes permission denial from unrelated capture failures', () => {
		assert.strictEqual(isMicrophonePermissionDeniedError(new DOMException('Denied', 'NotAllowedError')), true);
		const error = new Error('Denied');
		error.name = 'NotAllowedError';
		assert.strictEqual(isMicrophonePermissionDeniedError(error), true);
		assert.strictEqual(isMicrophonePermissionDeniedError(new Error('Unavailable')), false);
		assert.strictEqual(isMicrophonePermissionDeniedError(undefined), false);
	});
});
