/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { mainWindow } from '../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { resolveAutomaticVoiceLanguage, VoiceClientService } from '../../../browser/voiceClient/voiceClientService.js';
import { IVoiceClientService, IVoiceFeedbackPayload, IVoiceSessionContext, normalizeAgentsVoiceId } from '../../../common/voiceClient/voiceClientService.js';

suite('VoiceClientService - unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let sandbox: sinon.SinonSandbox;

	setup(() => { sandbox = sinon.createSandbox(); });
	teardown(() => { sandbox.restore(); });

	function createService(): VoiceClientService {
		return store.add(new VoiceClientService());
	}

	function assertDisconnected(service: IVoiceClientService): void {
		assert.strictEqual(service.isConnected, false);
		assert.strictEqual(service.isResuming, false);
		assert.strictEqual(service.isSessionAwarenessEnabled, false);
		assert.strictEqual(service.willReconnect, false);
		assert.strictEqual(service.currentSessionId, undefined);
	}

	function unreadable<T extends object>(): T {
		return new Proxy({} as T, {
			get: (_target, key) => { throw new Error(`Unexpected payload access: ${String(key)}`); }
		});
	}

	test('constructs through strict DI without speech, configuration or audio services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		assertDisconnected(store.add(instantiationService.createInstance(VoiceClientService)));
	});

	test('does not subscribe to persisted enabled voice settings', async () => {
		const config = new TestConfigurationService({ 'agents.voice.enabled': true, 'agents.voice.sessionAwareness': true });
		store.add(config.onDidChangeConfigurationEmitter);
		const instantiationService = store.add(new InstantiationService(new ServiceCollection([IConfigurationService, config]), true));
		const service = store.add(instantiationService.createInstance(VoiceClientService));
		assert.strictEqual(await service.hasGptLiveByok(), false);
		assert.strictEqual(config.onDidChangeConfigurationEmitter.hasListeners(), false);
		assertDisconnected(service);
	});

	test('reports a terminal startup failure on every connection attempt', async () => {
		const service = createService();
		const events: string[] = [];
		store.add(service.onError(reason => {
			assert.strictEqual(reason, 'Voice transport is unavailable in Myself IDE.');
			assertDisconnected(service);
			events.push('error');
		}));
		store.add(service.onFatalDisconnect(event => {
			assert.deepStrictEqual(event, { code: 0, reason: 'Voice transport is unavailable in Myself IDE.', kind: 'fatal' });
			assertDisconnected(service);
			events.push('fatal');
			service.disconnect();
		}));
		for (let attempt = 0; attempt < 2; attempt++) {
			await service.connect(unreadable<Window & typeof globalThis>(), 'test-token');
		}
		assert.deepStrictEqual(events, ['error', 'fatal', 'error', 'fatal']);
	});

	test('does not create network, remote audio or reconnect timers', async () => {
		const clock = sandbox.useFakeTimers();
		const guards = ['fetch', 'WebSocket', 'RTCPeerConnection', 'Audio'] as const;
		const stubs = guards.map(key => sandbox.stub(mainWindow, key).throws(new Error(`Unexpected ${key}`)));
		const service = createService();
		assert.strictEqual(await service.hasGptLiveByok(), false);
		await service.connect(mainWindow, 'test-token');
		await service.submitFeedback(unreadable<IVoiceFeedbackPayload>());
		service.disconnect();
		assert.strictEqual(clock.countTimers(), 0);
		await clock.tickAsync(120_000);
		assert.strictEqual(clock.countTimers(), 0);
		for (const stub of stubs) {
			assert.strictEqual(stub.callCount, 0);
		}
		assertDisconnected(service);
	});

	test('ignores audio, diagnostics, context, tool results and narration without reading payloads', () => {
		const service = createService();
		const clock = sandbox.useFakeTimers();
		const context = unreadable<IVoiceSessionContext>();
		const events = [service.onTranscription, service.onAudioResponse, service.onBargeIn, service.onNarrationAck, service.onNarrationUnblocked, service.onNarrationInterrupted, service.onToolCall, service.onSpeechStarted, service.onSessionInit, service.onDidChangeConnectionState, service.onDidChangeRemoteAudioState, service.onConnectionIssue, service.onTurnAutoEnded];
		let emitted = 0;
		for (const event of events) {
			store.add(event(() => emitted++));
		}
		for (let i = 0; i < 2; i++) {
			service.sendPttStart('test-turn', unreadable());
			service.sendPttAudioChunk('test-audio');
			service.sendPttEnd();
			service.sendPttDiagnostic('test-turn', unreadable());
			service.sendStartSession(context, 'test-machine', unreadable(), unreadable(), 'test instructions');
			service.sendResumeSession(context, 'test-machine', 'test instructions');
			service.sendSessionContext(context);
			service.flushSessionContext();
			service.invalidateSessionCache('test-session');
			service.sendToolResult('test-call', unreadable(), 'test-tool', unreadable());
			service.sendNarrationPlaybackComplete('test-session', 'test-narration', 'test-playback');
			assert.strictEqual(service.requestNarration('test-session', 'question', 'test text', 'test-narration', unreadable(), 'tool', unreadable()), undefined);
			service.sendSessionStateChange('test-session', 'idle', 'test label', 'test detail', 'test summary');
			service.stopSpeaking();
			service.prepareForInputTargetChange();
			service.disconnect();
		}
		assert.strictEqual(clock.countTimers(), 0);
		assert.strictEqual(emitted, 0);
		assertDisconnected(service);
	});

	test('refuses feedback without serializing transcript or identity data', async () => {
		const service = createService();
		assert.deepStrictEqual(await service.submitFeedback(unreadable<IVoiceFeedbackPayload>()), {
			ok: false, error: 'Voice feedback is unavailable in Myself IDE.'
		});
	});

	test('disposal releases failure listeners and cannot enable later calls', async () => {
		const service = createService();
		let emitted = 0;
		store.add(service.onError(() => emitted++));
		store.add(service.onFatalDisconnect(() => emitted++));
		service.dispose();
		service.dispose();
		await service.connect(unreadable());
		service.disconnect();
		assert.strictEqual(await service.hasGptLiveByok(), false);
		assert.strictEqual(emitted, 0);
		assertDisconnected(service);
	});

	test('normalizes every canonical and legacy voice identifier, and falls back for invalid values', () => {
		assert.deepStrictEqual(
			[
				'harper_neutral', 'birch_neutral', 'junho_neutral', 'oak_neutral',
				'victoria_neutral', 'maya_neutral', 'daniel_neutral', 'kevin_neutral',
				undefined, '  ', 42, 'unknown_voice',
			].map(normalizeAgentsVoiceId),
			[
				'harper_neutral', 'birch_neutral', 'junho_neutral', 'oak_neutral',
				'harper_neutral', 'birch_neutral', 'junho_neutral', 'oak_neutral',
				'birch_neutral', 'birch_neutral', 'birch_neutral', 'birch_neutral',
			]
		);
	});

	test('resolves automatic language from display language before browser locale', () => {
		assert.deepStrictEqual({
			displayLanguage: resolveAutomaticVoiceLanguage('en-US', 'de'),
			englishDisplayLanguage: resolveAutomaticVoiceLanguage('de-DE', 'en'),
			browserLocale: resolveAutomaticVoiceLanguage('pt-BR', undefined),
			unsupportedDisplayLanguage: resolveAutomaticVoiceLanguage('pt-BR', 'he-IL'),
			missing: resolveAutomaticVoiceLanguage(undefined, undefined),
		}, {
			displayLanguage: 'de',
			englishDisplayLanguage: 'en',
			browserLocale: 'pt-BR',
			unsupportedDisplayLanguage: 'pt-BR',
			missing: 'en-US',
		});
	});

});
