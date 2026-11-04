/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import '../../browser/terminal.chatAgentTools.contribution.js';
import '../../browser/tools/sendToTerminalTool.js';
import '../../../../chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { getSingletonServiceDescriptors } from '../../../../../../platform/instantiation/common/extensions.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ITerminalSandboxService, TerminalSandboxService } from '../../common/terminalSandboxService.js';

suite('Myself IDE terminal AI registrations', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('loading tools and shared chat rendering does not register terminal AI commands', () => {
		const removedCommands = [
			'focusChatInstance',
			'continueInBackground',
			'toggleChatTerminalOutput',
			'focusTerminalById',
			'focusTerminalByExecutionId',
			'addTerminalSelection',
		].map(name => `workbench.action.terminal.chat.${name}`);
		assert.deepStrictEqual(removedCommands.filter(id => CommandsRegistry.getCommand(id)), []);
	});

	test('keeps the real sandbox service available for shared consumers', () => {
		const registration = getSingletonServiceDescriptors().find(([id]) => id === ITerminalSandboxService);
		assert.strictEqual(registration?.[1].ctor, TerminalSandboxService);
	});
});
