/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SpeechService } from '../../browser/speechService.js';
import { ISpeechToTextEvent, ITextToSpeechEvent, SPEECH_LANGUAGE_CONFIG, SpeechToTextStatus, TextToSpeechStatus } from '../../common/speechService.js';

suite('Myself IDE unavailable voice live sessions', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const extension = new ExtensionIdentifier('test.voice');

	function createService() {
		const activations: string[] = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IExtensionService, new class extends mock<IExtensionService>() {
			override async activateByEvent(event: string): Promise<void> { activations.push(event); }
		}());
		const configuration = new TestConfigurationService({ [SPEECH_LANGUAGE_CONFIG]: 'en-US' });
		store.add(configuration.onDidChangeConfigurationEmitter);
		instantiationService.stub(IConfigurationService, configuration);
		const service = store.add(instantiationService.createInstance(SpeechService));
		return { service, activations };
	}

	test('availability checks and session requests never activate or invoke a live provider', async () => {
		const { service, activations } = createService();
		const offers: (string | undefined)[] = [];
		const registration = store.add(service.registerVoiceLiveSessionProvider('live', {
			metadata: { extension, displayName: 'Test Voice' },
			createVoiceLiveSession: async sdp => {
				offers.push(sdp);
				return { available: true, session: { sessionId: 'test-session', sdp: 'answer' } };
			},
		}));

		const results = [
			await service.createVoiceLiveSession('live', extension, undefined, CancellationToken.None),
			await service.createVoiceLiveSession('live', extension, 'test offer', CancellationToken.None),
			await service.createVoiceLiveSession('live', new ExtensionIdentifier('other.extension'), 'test offer', CancellationToken.None),
			await service.createVoiceLiveSession('missing', extension, 'test offer', CancellationToken.None),
			await service.createVoiceLiveSession('live', extension, 'test offer', CancellationToken.Cancelled),
		];
		registration.dispose();
		results.push(await service.createVoiceLiveSession('live', extension, 'test offer', CancellationToken.None));

		assert.deepStrictEqual({ results, activations, offers, hasSpeechProvider: service.hasSpeechProvider }, {
			results: [undefined, undefined, undefined, undefined, undefined, undefined],
			activations: [],
			offers: [],
			hasSpeechProvider: false,
		});
	});

	test('duplicate live registrations and repeated disposal are inert', () => {
		const { service, activations } = createService();
		let providerChanges = 0;
		store.add(service.onDidChangeHasSpeechProvider(() => providerChanges++));
		const provider = {
			get metadata() { throw new Error('Must not inspect disabled live provider'); },
			async createVoiceLiveSession() { throw new Error('Must not invoke disabled live provider'); },
		};
		const first = store.add(service.registerVoiceLiveSessionProvider('live', provider));
		const second = store.add(service.registerVoiceLiveSessionProvider('live', provider));
		first.dispose();
		first.dispose();
		second.dispose();
		store.add(service.registerVoiceLiveSessionProvider('live', provider));

		assert.deepStrictEqual({ activations, providerChanges, hasSpeechProvider: service.hasSpeechProvider }, {
			activations: [], providerChanges: 0, hasSpeechProvider: false,
		});
	});

	test('disposing the service releases its speech extension handler', () => {
		const first = createService();
		first.service.dispose();
		const second = createService();
		assert.deepStrictEqual([first.activations, second.activations, second.service.hasSpeechProvider], [[], [], false]);
	});

	test('ordinary speech providers still activate, transcribe and synthesize', async () => {
		const { service, activations } = createService();
		const source = store.add(new CancellationTokenSource());
		const speechEvents = store.add(new Emitter<ISpeechToTextEvent>());
		const textEvents = store.add(new Emitter<ITextToSpeechEvent>());
		const calls: string[] = [];
		const speechSession = { onDidChange: speechEvents.event };
		const textSession = {
			onDidChange: textEvents.event,
			async synthesize(text: string) { calls.push(text); },
		};
		const registration = store.add(service.registerSpeechProvider('speech', {
			metadata: { extension, displayName: 'Test Speech' },
			createSpeechToTextSession(token, options) {
				assert.strictEqual(token, source.token);
				calls.push(`speech:${options?.language}`);
				return speechSession;
			},
			createTextToSpeechSession(token, options) {
				assert.strictEqual(token, source.token);
				calls.push(`text:${options?.language}`);
				return textSession;
			},
			createKeywordRecognitionSession() { throw new Error('Not requested'); },
		}));

		const speech = await service.createSpeechToTextSession(source.token);
		const text = await service.createTextToSpeechSession(source.token);
		speechEvents.fire({ status: SpeechToTextStatus.Started });
		textEvents.fire({ status: TextToSpeechStatus.Started });
		const active = [service.hasSpeechProvider, service.hasActiveSpeechToTextSession, service.hasActiveTextToSpeechSession];
		await text.synthesize('Test text');
		source.cancel();
		registration.dispose();

		assert.deepStrictEqual({
			activations, calls, active,
			originalSessions: speech === speechSession && text === textSession,
			inactive: [service.hasSpeechProvider, service.hasActiveSpeechToTextSession, service.hasActiveTextToSpeechSession],
		}, {
			activations: ['onSpeech', 'onSpeech'],
			calls: ['speech:en-US', 'text:en-US', 'Test text'],
			active: [true, true, true],
			originalSessions: true,
			inactive: [false, false, false],
		});
	});
});
