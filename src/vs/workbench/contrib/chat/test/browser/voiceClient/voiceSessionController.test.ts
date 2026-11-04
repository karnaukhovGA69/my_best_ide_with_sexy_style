/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { Emitter } from '../../../../../../base/common/event.js';
import { autorun, derived, observableFromEvent } from '../../../../../../base/common/observable.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { IVoiceSessionController, isVoiceSessionActiveForInput, VoiceSessionController } from '../../../browser/voiceClient/voiceSessionController.js';

suite('Voice Mode input ownership', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const target = URI.parse('agent-host-copilot:/session-1');
	const other = URI.parse('agent-host-copilot:/session-2');

	test('follows a pinned session target independently of input focus', () => {
		assert.deepStrictEqual({
			matchingUnfocused: isVoiceSessionActiveForInput(false, target, false, target),
			mismatchedFocused: isVoiceSessionActiveForInput(true, target, false, other),
			targetlessFocused: isVoiceSessionActiveForInput(true, undefined, false, target),
			targetlessUnfocused: isVoiceSessionActiveForInput(false, undefined, false, target),
			draft: isVoiceSessionActiveForInput(true, undefined, true, target),
			ownedDraft: isVoiceSessionActiveForInput(false, undefined, true, target, true),
		}, {
			matchingUnfocused: true,
			mismatchedFocused: false,
			targetlessFocused: true,
			targetlessUnfocused: false,
			draft: false,
			ownedDraft: true,
		});
	});

	test('updates when a chat input materializes its pinned session resource', () => {
		const viewModelChange = store.add(new Emitter<void>());
		const viewModel: { resource: URI | undefined } = { resource: undefined };
		const sessionResource = observableFromEvent(store, viewModelChange.event, () => viewModel.resource);
		const active = derived(store, reader => isVoiceSessionActiveForInput(false, target, false, sessionResource.read(reader)));
		let current = false;
		store.add(autorun(reader => {
			current = active.read(reader);
		}));

		viewModel.resource = target;
		viewModelChange.fire();

		assert.strictEqual(current, true);
	});
});

suite('VoiceSessionController - unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let sandbox: sinon.SinonSandbox;

	setup(() => { sandbox = sinon.createSandbox(); });
	teardown(() => { sandbox.restore(); });

	function unreadable<T extends object>(): T {
		return new Proxy({} as T, {
			get: (_target, key) => { throw new Error(`Unexpected input access: ${String(key)}`); }
		});
	}

	function assertUnavailable(controller: IVoiceSessionController): void {
		assert.strictEqual(controller.voiceState.get(), 'error');
		assert.strictEqual(controller.statusText.get(), 'Voice Mode is unavailable in Myself IDE.');
		assert.strictEqual(controller.isConnected.get(), false);
		assert.strictEqual(controller.isConnecting.get(), false);
		assert.strictEqual(controller.isReconnecting.get(), false);
		assert.strictEqual(controller.isUsingGptLive, false);
		assert.strictEqual(controller.isMuted.get(), false);
		assert.deepStrictEqual(controller.transcriptTurns.get(), []);
		assert.deepStrictEqual(controller.pendingToolConfirmations.get(), []);
		assert.strictEqual(controller.targetSession.get(), undefined);
		assert.strictEqual(controller.hasDraftTarget.get(), false);
		assert.strictEqual(controller.getLastSpokenResponseSession(), undefined);
	}

	test('constructs through strict DI without auth, audio, chat, storage or telemetry services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		assertUnavailable(store.add(instantiationService.createInstance(VoiceSessionController)));
	});

	test('ignores persisted enabled voice settings without subscribing', async () => {
		const config = new TestConfigurationService({ 'agents.voice.enabled': true, 'agents.voice.handsFree': true });
		store.add(config.onDidChangeConfigurationEmitter);
		const instantiationService = store.add(new InstantiationService(new ServiceCollection([IConfigurationService, config]), true));
		const controller = store.add(instantiationService.createInstance(VoiceSessionController));
		await controller.connect(unreadable());
		assert.strictEqual(config.onDidChangeConfigurationEmitter.hasListeners(), false);
		assertUnavailable(controller);
	});

	test('never connects or registers window handlers and watchdog timers', async () => {
		const clock = sandbox.useFakeTimers();
		const controller = store.add(new VoiceSessionController());
		const window = unreadable<Window & typeof globalThis>();
		controller.setActiveWindow(window);
		await Promise.all([controller.connect(window), controller.connect(window)]);
		controller.disconnect('explicit');
		await controller.connect(window);
		controller.simulateConnection();
		assert.strictEqual(clock.countTimers(), 0);
		await clock.tickAsync(120_000);
		assert.strictEqual(clock.countTimers(), 0);
		assertUnavailable(controller);
	});

	test('capture and hands-free controls cannot activate the microphone', () => {
		const clock = sandbox.useFakeTimers();
		const controller = store.add(new VoiceSessionController());
		for (const source of ['explicit', 'auto', 'connect'] as const) {
			controller.pttDown(source, true);
			controller.pttUp('explicit', true);
			controller.setAutoListenHeld(true);
			controller.setAutoListenHeld(false);
			controller.setMuted(true);
			controller.setMuted(false);
			controller.stopListening('explicit');
			controller.discardListening();
			assertUnavailable(controller);
		}
		assert.strictEqual(clock.countTimers(), 0);
	});

	test('session navigation and dictation do not read session resources or submit input', () => {
		const controller = store.add(new VoiceSessionController());
		const resource = unreadable<URI>();
		controller.setTargetSession(resource);
		controller.setDraftTarget();
		controller.newSessionAsTarget();
		controller.setActiveSessionShown(resource);
		controller.promoteDraftTarget(resource);
		controller.activateSession(resource);
		controller.finishListeningAndSubmitTo(resource);
		controller.markUserCancelled('test-session');
		controller.setTargetSession(undefined);
		controller.setActiveSessionShown(null);
		controller.setActiveSessionShown(undefined);
		assertUnavailable(controller);
	});

	test('does not expose confirmations, transcripts or state changes to observers', async () => {
		const controller = store.add(new VoiceSessionController());
		let updates = 0;
		store.add(autorun(reader => {
			controller.voiceState.read(reader);
			controller.statusText.read(reader);
			controller.transcriptTurns.read(reader);
			controller.pendingToolConfirmations.read(reader);
			controller.isConnected.read(reader);
			controller.isConnecting.read(reader);
			controller.isReconnecting.read(reader);
			controller.isMuted.read(reader);
			controller.targetSession.read(reader);
			controller.hasDraftTarget.read(reader);
			updates++;
		}));
		await controller.connect(unreadable());
		controller.simulateConnection();
		controller.pttDown();
		controller.setTargetSession(unreadable());
		controller.disconnect();
		assert.strictEqual(updates, 1);
		assertUnavailable(controller);
	});

	test('does not register replay or stop commands', () => {
		const controller = store.add(new VoiceSessionController());
		for (const id of ['_chat.voicePlayback.replay', '_chat.voicePlayback.stop']) {
			assert.strictEqual(CommandsRegistry.getCommand(id), undefined);
		}
		controller.dispose();
		for (const id of ['_chat.voicePlayback.replay', '_chat.voicePlayback.stop']) {
			assert.strictEqual(CommandsRegistry.getCommand(id), undefined);
		}
	});

	test('feedback returns an explicit failure without gathering user data', async () => {
		const controller = store.add(new VoiceSessionController());
		assert.deepStrictEqual(await controller.submitFeedback('test feedback'), {
			ok: false, error: 'Voice feedback is unavailable in Myself IDE.'
		});
		assertUnavailable(controller);
	});

	test('repeated disposal and later calls remain inactive', async () => {
		const controller = store.add(new VoiceSessionController());
		controller.dispose();
		controller.dispose();
		await controller.connect(unreadable());
		controller.pttDown();
		controller.simulateConnection();
		controller.disconnect();
		assertUnavailable(controller);
	});
});
