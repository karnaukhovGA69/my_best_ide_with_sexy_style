/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import product from '../../../../../../platform/product/common/product.js';
import { IProductService } from '../../../../../../platform/product/common/productService.js';
import { VoiceCodeTranscriptionClient } from '../../../browser/speechToText/voiceCodeTranscriptionClient.js';

suite('Myself IDE unavailable transcription transport', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const unavailableMessage = 'AI voice transcription is unavailable in Myself IDE.';

	function isUnavailable(error: unknown): boolean {
		return error instanceof Error && error.message === unavailableMessage;
	}

	async function assertUnavailable(request: Promise<void>): Promise<void> {
		try {
			await request;
		} catch (error) {
			assert.ok(isUnavailable(error));
			return;
		}
		assert.fail('Disabled transcription must reject the request');
	}

	function createClient(backendUrl?: string) {
		const configuration = new TestConfigurationService({
			'agents.voice.enabled': true,
			'agents.voice.backendUrl': backendUrl,
		});
		store.add(configuration.onDidChangeConfigurationEmitter);
		const instantiation = store.add(new TestInstantiationService());
		instantiation.stub(IConfigurationService, configuration);
		instantiation.stub(IProductService, {
			_serviceBrand: undefined,
			...product,
			voiceWsUrl: 'wss://transcription.invalid/voice-code/api/v1/realtime/voice',
		});
		instantiation.stub(ILogService, new NullLogService());
		return store.add(instantiation.createInstance(VoiceCodeTranscriptionClient));
	}

	function createUnusedWindow(): Window & typeof globalThis {
		return new Proxy(mainWindow, {
			get(_target, property) {
				throw new Error(`Disabled transcription must not access window.${String(property)}`);
			},
		});
	}

	test('configured endpoints cannot open a socket or access the supplied window', async () => {
		for (const backendUrl of [undefined, 'ws://localhost:9999/realtime/voice']) {
			const client = createClient(backendUrl);
			await assertUnavailable(client.connect(createUnusedWindow(), 'test-auth-token'));
			assert.strictEqual(client.isConnected, false);
		}
	});

	test('session initialization rejects before or after a failed connection', async () => {
		const client = createClient();
		await assertUnavailable(client.startSession());
		await assertUnavailable(client.connect(createUnusedWindow(), ''));
		await assertUnavailable(client.startSession());
	});

	test('all audio send operations reject without echoing input', () => {
		const client = createClient();
		for (const turnId of ['', 'test-turn']) {
			assert.throws(() => client.sendPttStart(turnId), isUnavailable);
			assert.throws(() => client.sendPttAudioChunk(turnId, 'test-audio-payload'), isUnavailable);
			assert.throws(() => client.sendPttEnd(turnId), isUnavailable);
		}
	});

	test('failure and repeated cleanup do not emit fabricated session events', async () => {
		const client = createClient();
		const events: string[] = [];
		store.add(client.onTranscription(() => events.push('transcription')));
		store.add(client.onError(() => events.push('error')));
		store.add(client.onDidClose(() => events.push('close')));
		client.disconnect();
		await assertUnavailable(client.connect(createUnusedWindow(), 'test-auth-token'));
		client.disconnect();
		client.disconnect();
		client.dispose();
		client.dispose();
		client.disconnect();
		await assertUnavailable(client.connect(createUnusedWindow(), 'test-auth-token'));
		await assertUnavailable(client.startSession());

		assert.deepStrictEqual({ events, connected: client.isConnected }, { events: [], connected: false });
	});
});
