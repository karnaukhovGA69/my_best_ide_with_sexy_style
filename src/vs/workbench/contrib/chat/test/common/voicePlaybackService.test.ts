/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { autorun } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IVoicePlaybackService, VoicePlaybackService } from '../../common/voicePlaybackService.js';

suite('Myself IDE unavailable voice playback', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const first = URI.parse('test-session:first');
	const second = URI.parse('test-session:second');

	function createService(): VoicePlaybackService {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		return store.add(instantiation.createInstance(VoicePlaybackService));
	}

	test('module load keeps delayed DI without registering notification commands', () => {
		const descriptor = getSingletonServiceDescriptors().find(([id]) => id === IVoicePlaybackService)?.[1];
		assert.deepStrictEqual({
			ctor: descriptor?.ctor,
			delayed: descriptor?.supportsDelayedInstantiation,
			commands: ['_chat.voicePlayback.notifyStart', '_chat.voicePlayback.notifyEnd'].filter(id => CommandsRegistry.getCommand(id)),
		}, { ctor: VoicePlaybackService, delayed: true, commands: [] });
	});

	test('notifications do not retain transcripts or pending sessions', () => {
		const service = createService();
		service.notifyPlaybackStart(first, 'First test transcript');
		service.setPendingResponse(first, true);
		service.notifyPlaybackStart(second, 'Second test transcript');
		service.setPendingResponse(second, true);
		service.notifyPlaybackEnd(first);
		service.notifyPlaybackStart(undefined, 'Unscoped test transcript');
		service.notifyPlaybackEnd(undefined);
		service.setPendingResponse(first, false);

		assert.deepStrictEqual({
			speaking: service.speakingSession.get(),
			versions: [service.lastPlayedVersion.get(), service.pendingResponseVersion.get()],
			entries: [service.getLastPlayed(first), service.getLastPlayed(second)],
			played: [service.hasLastPlayed(first), service.hasLastPlayed(second)],
			pending: [service.hasPendingResponse(first), service.hasPendingResponse(second)],
		}, { speaking: undefined, versions: [0, 0], entries: [undefined, undefined], played: [false, false], pending: [false, false] });
	});

	test('replay and stop do not dispatch commands even after notifications', async () => {
		const service = createService();
		const calls: string[] = [];
		for (const id of ['_chat.voicePlayback.replay', '_chat.voicePlayback.stop']) {
			store.add(CommandsRegistry.registerCommand(id, () => calls.push(id)));
		}
		service.notifyPlaybackStart(first, 'Test transcript');
		await service.replay(first);
		await service.replay(second);
		service.stop(first);
		service.stop();
		assert.deepStrictEqual(calls, []);
	});

	test('observable consumers see a single stable empty snapshot', async () => {
		const service = createService();
		const snapshots: [URI | undefined, number, number][] = [];
		store.add(autorun(reader => {
			snapshots.push([service.speakingSession.read(reader), service.lastPlayedVersion.read(reader), service.pendingResponseVersion.read(reader)]);
		}));
		service.notifyPlaybackStart(first, 'Test transcript');
		service.setPendingResponse(first, true);
		await service.replay(first);
		service.notifyPlaybackEnd(first);
		service.setPendingResponse(first, false);
		service.stop();
		assert.deepStrictEqual(snapshots, [[undefined, 0, 0]]);
	});

	test('disabled operations do not inspect the session resource', async () => {
		const service = createService();
		const resource = new Proxy(first, {
			get() { throw new Error('Disabled playback must not inspect session resource'); },
		});
		service.notifyPlaybackStart(resource, 'Test transcript');
		service.notifyPlaybackEnd(resource);
		service.setPendingResponse(resource, true);
		await service.replay(resource);
		service.stop(resource);
		assert.deepStrictEqual([service.getLastPlayed(resource), service.hasLastPlayed(resource), service.hasPendingResponse(resource)], [undefined, false, false]);
	});

	test('repeated disposal and cleanup never revive playback', async () => {
		const service = createService();
		service.dispose();
		service.dispose();
		service.notifyPlaybackStart(first, 'Test transcript');
		service.setPendingResponse(first, true);
		await service.replay(first);
		service.stop(first);
		service.stop();
		assert.deepStrictEqual([service.speakingSession.get(), service.getLastPlayed(first), service.hasPendingResponse(first)], [undefined, undefined, false]);
	});
});
