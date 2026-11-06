/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { registerChatOpenAgentDebugPanelAction } from '../../../browser/actions/chatOpenAgentDebugPanelAction.js';

suite('Agent debug actions disabled', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register debug panel, session, import, or export commands', () => {
		registerChatOpenAgentDebugPanelAction();
		registerChatOpenAgentDebugPanelAction();
		for (const command of ['openAgentDebugPanel', 'openAgentDebugPanelForSession', 'exportAgentDebugLog', 'importAgentDebugLog']) {
			assert.strictEqual(CommandsRegistry.getCommand(`workbench.action.chat.${command}`), undefined);
		}
	});
});
