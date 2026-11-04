/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import '../../browser/terminal.chat.contribution.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TerminalExtensionsRegistry } from '../../../../terminal/browser/terminalExtensions.js';
import { ITerminalChatService, ITerminalInstance } from '../../../../terminal/browser/terminal.js';
import { UnavailableTerminalChatService, UnavailableTerminalChatSessionResolver } from '../../browser/unavailableTerminalChat.js';

suite('Myself IDE unavailable terminal chat', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register a controller or terminal chat commands', () => {
		assert.ok(!TerminalExtensionsRegistry.getTerminalContributions().some(c => c.id === 'terminal.chat'));
		assert.deepStrictEqual([...CommandsRegistry.getCommands().keys()].filter(id => id.startsWith('workbench.action.terminal.chat.')), []);
	});

	test('cannot resolve local or Agent Host sessions', async () => {
		assert.strictEqual(await new UnavailableTerminalChatSessionResolver().resolve(), undefined);
	});

	test('does not retain terminals or grant automatic command approval', async () => {
		const service: ITerminalChatService = new UnavailableTerminalChatService();
		const instance = new Proxy({} as ITerminalInstance, { get() { throw new Error('Must not touch terminal'); } });
		const uri = URI.parse('test:session');
		service.registerTerminalInstanceWithToolSession('tool', instance);
		service.registerTerminalInstanceWithChatSession(uri, instance);
		service.registerTerminalInstanceWithExecutionId('execution', instance).dispose();
		service.setChatSessionAutoApproval(uri, true);
		service.addSessionAutoApproveRule(uri, '*', true);
		assert.strictEqual(await service.getTerminalInstanceByToolSessionId('tool'), undefined);
		assert.strictEqual(service.getTerminalInstanceByExecutionId('execution'), undefined);
		assert.deepStrictEqual(service.getToolSessionTerminalInstances(), []);
		assert.strictEqual(service.hasChatSessionAutoApproval(uri), false);
		assert.deepStrictEqual(service.getSessionAutoApproveRules(uri), {});
	});
});
