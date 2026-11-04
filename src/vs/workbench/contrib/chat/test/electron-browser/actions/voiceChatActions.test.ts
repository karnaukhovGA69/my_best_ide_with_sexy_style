/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { DeferredPromise } from '../../../../../../base/common/async.js';
import { Event, Emitter } from '../../../../../../base/common/event.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { IAccessibilityService } from '../../../../../../platform/accessibility/common/accessibility.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { MockContextKeyService } from '../../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ISpeechService } from '../../../../speech/common/speechService.js';
import { IVoiceChatService, IVoiceChatSession, VoiceChatService } from '../../../common/voiceChatService.js';
import { parseNextChatResponseChunk, VoiceChatSessions } from '../../../electron-browser/actions/voiceChatActions.js';

suite('VoiceChatActions', function () {

	function assertChunk(text: string, expected: string | undefined, offset: number): { chunk: string | undefined; offset: number } {
		const res = parseNextChatResponseChunk(text, offset);
		assert.strictEqual(res.chunk, expected);

		return res;
	}

	test('parseNextChatResponseChunk', function () {

		// Simple, no offset
		assertChunk('Hello World', undefined, 0);
		assertChunk('Hello World.', undefined, 0);
		assertChunk('Hello World. ', 'Hello World.', 0);
		assertChunk('Hello World? ', 'Hello World?', 0);
		assertChunk('Hello World! ', 'Hello World!', 0);
		assertChunk('Hello World: ', 'Hello World:', 0);

		// Ensure chunks are parsed from the end, no offset
		assertChunk('Hello World. How is your day? And more...', 'Hello World. How is your day?', 0);

		// Ensure chunks are parsed from the end, with offset
		let offset = assertChunk('Hello World. How is your ', 'Hello World.', 0).offset;
		offset = assertChunk('Hello World. How is your day? And more...', 'How is your day?', offset).offset;
		offset = assertChunk('Hello World. How is your day? And more to come! ', 'And more to come!', offset).offset;
		assertChunk('Hello World. How is your day? And more to come! ', undefined, offset);

		// Sparted by newlines
		offset = assertChunk('Hello World.\nHow is your', 'Hello World.', 0).offset;
		assertChunk('Hello World.\nHow is your day?\n', 'How is your day?', offset);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});


suite('VoiceChat startup failure cleanup', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createSessions(service: IVoiceChatService): VoiceChatSessions {
		const configuration = new TestConfigurationService();
		store.add(configuration.onDidChangeConfigurationEmitter);
		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[IVoiceChatService, service],
			[IConfigurationService, configuration],
			[ISpeechService, new class extends mock<ISpeechService>() { }()],
			[IAccessibilityService, new class extends mock<IAccessibilityService>() { }()],
		), true));
		const sessions = instantiation.createInstance(VoiceChatSessions);
		store.add(toDisposable(() => sessions.stop()));
		return sessions;
	}

	function createController() {
		const accepted = store.add(new Emitter<void>());
		const hidden = store.add(new Emitter<void>());
		const states: number[] = [];
		let text = 'Existing draft';
		let cleared = 0;
		const controller: Parameters<VoiceChatSessions['start']>[0] = {
			onDidAcceptInput: accepted.event,
			onDidHideInput: hidden.event,
			context: 'inline',
			scopedContextKeyService: new MockContextKeyService(),
			updateState: state => states.push(state),
			focusInput() { },
			async acceptInput() { return undefined; },
			updateInput: value => { text = value; },
			getInput: () => text,
			setInputPlaceholder() { },
			clearInputPlaceholder: () => { cleared++; },
		};
		return { controller, states, accepted, hidden, get cleared() { return cleared; } };
	}

	test('unavailable recognition restores the controller and releases listeners on every attempt', async () => {
		const service = store.add(new VoiceChatService());
		const sessions = createSessions(service);
		const fixture = createController();
		for (let attempt = 0; attempt < 2; attempt++) {
			let errorMessage: string | undefined;
			try {
				await sessions.start(fixture.controller);
			} catch (error) {
				assert.ok(error instanceof Error);
				errorMessage = error.message;
			}
			assert.strictEqual(errorMessage, 'Voice chat is unavailable in Myself IDE.');
		}
		assert.deepStrictEqual({
			states: fixture.states,
			listeners: [fixture.accepted.hasListeners(), fixture.hidden.hasListeners()],
			cleared: fixture.cleared,
			text: fixture.controller.getInput(),
		}, { states: [2, 1, 2, 1], listeners: [false, false], cleared: 2, text: 'Existing draft' });
	});

	test('synchronous startup errors are rethrown after cancelling the failed session token', async () => {
		const failure = new Error('Test startup failure');
		let cancelled = false;
		const sessions = createSessions({
			_serviceBrand: undefined,
			createVoiceChatSession(token) {
				store.add(token.onCancellationRequested(() => { cancelled = true; }));
				throw failure;
			},
		});
		const fixture = createController();
		await sessions.start(fixture.controller).then(() => assert.fail('Expected startup failure'), error => assert.strictEqual(error, failure));
		assert.deepStrictEqual([cancelled, fixture.states, fixture.accepted.hasListeners(), fixture.hidden.hasListeners()], [true, [2, 1], false, false]);
	});

	test('a late failure cannot stop a newer session', async () => {
		const firstStart = new DeferredPromise<IVoiceChatSession>();
		let calls = 0;
		const sessions = createSessions({
			_serviceBrand: undefined,
			createVoiceChatSession: () => ++calls === 1 ? firstStart.p : Promise.resolve({ onDidChange: Event.None }),
		});
		const first = createController();
		const second = createController();
		const failure = new Error('Test late startup failure');
		const failed = sessions.start(first.controller).then(() => assert.fail('Expected startup failure'), error => assert.strictEqual(error, failure));
		const current = await sessions.start(second.controller);
		await firstStart.error(failure);
		await failed;
		assert.deepStrictEqual({
			first: first.states,
			second: second.states,
			listeners: [second.accepted.hasListeners(), second.hidden.hasListeners()],
		}, { first: [2, 1], second: [2], listeners: [true, true] });
		current.stop();
		assert.deepStrictEqual([second.states, second.accepted.hasListeners(), second.hidden.hasListeners()], [[2, 1], false, false]);
	});
});
