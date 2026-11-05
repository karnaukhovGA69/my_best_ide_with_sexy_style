/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IVoiceChatSessionOptions, VoiceChatInProgress, VoiceChatService } from '../../common/voiceChatService.js';

suite('Myself IDE unavailable legacy voice chat', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): VoiceChatService {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		return store.add(instantiation.createInstance(VoiceChatService));
	}

	async function assertUnavailable(request: Promise<object>): Promise<void> {
		try {
			await request;
		} catch (error) {
			assert.ok(error instanceof Error);
			assert.strictEqual(error.message, 'Voice chat is unavailable in Myself IDE.');
			return;
		}
		assert.fail('Legacy voice chat must reject session creation');
	}

	test('constructs without speech, agent or context services', async () => {
		const service = createService();
		await assertUnavailable(service.createVoiceChatSession(CancellationToken.None, { usesAgents: true }));
		assert.strictEqual(VoiceChatInProgress.bindTo(new MockContextKeyService()).get(), false);
	});

	test('rejects both agent-aware and inline sessions including cancellation', async () => {
		const service = createService();
		for (const token of [CancellationToken.None, CancellationToken.Cancelled]) {
			for (const options of [{}, { usesAgents: true }, { usesAgents: false }]) {
				await assertUnavailable(service.createVoiceChatSession(token, options));
			}
		}
	});

	test('does not inspect the token, chat model or session options', async () => {
		const service = createService();
		const token = new Proxy(CancellationToken.None, { get() { throw new Error('Must not subscribe to disabled voice session token'); } });
		const options = new Proxy({} as IVoiceChatSessionOptions, { get() { throw new Error('Must not inspect disabled voice session options'); } });
		await assertUnavailable(service.createVoiceChatSession(token, options));
	});

	test('repeated requests and disposal cannot enable recognition', async () => {
		const service = createService();
		await Promise.all([0, 1, 2].map(() => assertUnavailable(service.createVoiceChatSession(CancellationToken.None, {}))));
		service.dispose();
		service.dispose();
		await assertUnavailable(service.createVoiceChatSession(CancellationToken.None, {}));
	});
});
