/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { postProcessTerminalDictation, TerminalVoiceSession } from '../../browser/terminalVoice.js';
import { registerTerminalVoiceActions } from '../../browser/terminalVoiceActions.js';

suite('postProcessTerminalDictation', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('substitutes spoken symbols including single word forms like "dash"', () => {
		assert.strictEqual(postProcessTerminalDictation('ls dash la'), 'ls - la');
	});

	test('prefers multi-word symbol phrases over their single word forms', () => {
		assert.strictEqual(postProcessTerminalDictation('echo dollar sign path'), 'echo $ path');
	});

	test('strips sentence punctuation added by the transcriber', () => {
		assert.strictEqual(postProcessTerminalDictation('git status.'), 'git status');
	});

	test('lower-cases the capitalized first word', () => {
		assert.strictEqual(postProcessTerminalDictation('Echo hello'), 'echo hello');
	});

	test('substitutes every occurrence of a symbol name', () => {
		assert.strictEqual(postProcessTerminalDictation('a ampersand b ampersand c'), 'a & b & c');
	});
});

suite('Terminal dictation unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('strict DI session has no terminal or speech dependencies and schedules nothing', async () => {
		const sandbox = sinon.createSandbox();
		const timers = sandbox.useFakeTimers();
		try {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			const session = store.add(instantiation.createInstance(TerminalVoiceSession));
			for (let i = 0; i < 2; i++) {
				await session.start();
				session.stop(true);
				session.stop(false);
				session.stop();
				session.dispose();
			}
			await timers.tickAsync(30000);
			assert.strictEqual(timers.countTimers(), 0);
		} finally {
			sandbox.restore();
		}
	});

	test('singleton lookup never accesses instantiation or terminal services', async () => {
		const unreadable = new Proxy({} as IInstantiationService, { get: () => { throw new Error('Instantiation service must not be read'); } });
		const session = TerminalVoiceSession.getInstance(unreadable);
		assert.strictEqual(TerminalVoiceSession.getInstance(unreadable), session);
		await session.start();
		session.stop(true);
	});

	test('action registration leaves the existing command registry unchanged', () => {
		const commands = Array.from(CommandsRegistry.getCommands().keys());
		registerTerminalVoiceActions();
		assert.deepStrictEqual(Array.from(CommandsRegistry.getCommands().keys()), commands);
	});
});
