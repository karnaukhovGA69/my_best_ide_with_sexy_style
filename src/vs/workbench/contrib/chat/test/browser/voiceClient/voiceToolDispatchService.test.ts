/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { upcastDeepPartial } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { IVoiceToolDispatchDelegate, resolveVoiceModel, VoiceToolDispatchService } from '../../../browser/voiceClient/voiceToolDispatchService.js';
import { IChatModel } from '../../../common/model/chatModel.js';
import { ILanguageModelChatMetadataAndIdentifier } from '../../../common/languageModels.js';
import { getVoiceRecentTurns, IVoiceToolCall } from '../../../common/voiceClient/voiceClientService.js';

suite('VoiceToolDispatchService - model selection', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const model = (identifier: string, name: string, id = name): ILanguageModelChatMetadataAndIdentifier => ({
		identifier,
		metadata: { name, id, family: id, vendor: 'copilot' },
	} as ILanguageModelChatMetadataAndIdentifier);

	test('matches a unique normalized model name', () => {
		const result = resolveVoiceModel([
			model('copilot/gpt-5', 'GPT-5'),
			model('copilot/claude', 'Claude Sonnet 4'),
		], 'gpt 5');

		assert.deepStrictEqual(result, {
			ok: true,
			identifier: 'copilot/gpt-5',
			selected_model: { identifier: 'copilot/gpt-5', name: 'GPT-5', vendor: 'copilot' },
		});
	});

	test('returns candidates instead of guessing between ambiguous names', () => {
		const result = resolveVoiceModel([
			model('copilot/gpt-5-fast', 'GPT-5'),
			model('openai/gpt-5', 'GPT-5'),
		], 'GPT-5');

		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.reason, 'ambiguous_model');
		assert.deepStrictEqual(result.available_models?.map(candidate => candidate.identifier), ['copilot/gpt-5-fast', 'openai/gpt-5']);
	});
});

suite('VoiceToolDispatchService - recent turns helper', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('bounds recent turns and excludes unfinished assistant text only when requested', () => {
		const model = upcastDeepPartial<IChatModel>({
			getRequests: () => Array.from({ length: 5 }, (_, index) => ({
				message: { text: `${index}`.repeat(500) },
				response: {
					isComplete: index !== 4,
					isCanceled: index === 3,
					response: { value: [{ kind: 'markdownContent', content: new MarkdownString('a'.repeat(1000)) }] },
				},
			})),
		});
		assert.deepStrictEqual({
			briefing: getVoiceRecentTurns(model, 3, true),
			thread: getVoiceRecentTurns(model, 1),
		}, {
			briefing: [
				{ user: '2'.repeat(400), assistant: 'a'.repeat(600) },
				{ user: '3'.repeat(400), assistant: '' },
				{ user: '4'.repeat(400), assistant: '' },
			],
			thread: [{ user: '4'.repeat(400), assistant: 'a'.repeat(600) }],
		});
	});

	test('treats missing user text as empty when reading recent turns', () => {
		const model = upcastDeepPartial<IChatModel>({
			getRequests: () => [{ message: {} }],
		});
		assert.deepStrictEqual(getVoiceRecentTurns(model, 3), [{ user: '', assistant: '' }]);
	});

});

suite('VoiceToolDispatchService - unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): VoiceToolDispatchService {
		const service = new VoiceToolDispatchService();
		service.setDelegate(new Proxy({} as IVoiceToolDispatchDelegate, {
			get: (_target, key) => { throw new Error(`Unexpected delegate access: ${String(key)}`); }
		}));
		return service;
	}

	test('constructs without agent sessions, chat or language model tools services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		assert.ok(instantiationService.createInstance(VoiceToolDispatchService));
	});

	for (const name of ['send_to_chat', 'focus_session', 'set_model', 'auto_approve_session', 'revoke_auto_approve', 'get_session_info', 'get_session_changes', 'get_session_thread', 'respond_to_session', 'unknown_tool']) {
		test(`refuses ${name} without consulting the delegate`, async () => {
			const service = createService();
			const result = await service.dispatchToolCall({
				callId: 'test-call', name,
				args: { text: 'test input', coding_session_id: 'test-session', model: 'test-model', response: { type: 'approve' } }
			});
			assert.strictEqual(result, 'error: voice tools are unavailable');
		});
	}

	for (const type of ['approve', 'reject', 'answer', 'skip']) {
		test(`refuses a structured ${type} response`, async () => {
			const service = createService();
			assert.deepStrictEqual(await service.respondToSession({
				callId: 'test-call', name: 'respond_to_session',
				args: { coding_session_id: 'test-session', request_id: 'test-request', pending_id: 'test-pending', response: { type, answers: {} } }
			}), { ok: false, reason: 'unsupported' });
		});
	}

	test('refuses canceled calls without reading the payload', async () => {
		const service = createService();
		const call = new Proxy({} as IVoiceToolCall, {
			get: (_target, key) => { throw new Error(`Unexpected payload access: ${String(key)}`); }
		});
		assert.strictEqual(await service.dispatchToolCall(call), 'error: voice tools are unavailable');
		assert.deepStrictEqual(await service.respondToSession(call, CancellationToken.Cancelled), { ok: false, reason: 'unsupported' });
	});

	test('refuses calls before a delegate is supplied and after it is replaced', async () => {
		const service = new VoiceToolDispatchService();
		const call: IVoiceToolCall = { callId: 'test-call', name: 'send_to_chat', args: { text: 'test input' } };
		assert.strictEqual(await service.dispatchToolCall(call), 'error: voice tools are unavailable');
		for (let i = 0; i < 2; i++) {
			service.setDelegate(new Proxy({} as IVoiceToolDispatchDelegate, {
				get: () => { throw new Error('Unexpected delegate access'); }
			}));
			assert.strictEqual(await service.dispatchToolCall(call), 'error: voice tools are unavailable');
		}
	});
});
