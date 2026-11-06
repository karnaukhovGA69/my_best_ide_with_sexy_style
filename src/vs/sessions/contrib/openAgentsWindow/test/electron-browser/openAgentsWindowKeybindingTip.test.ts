/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import '../../electron-browser/openAgentsWindowKeybindingTip.js';

suite('Agents window shortcut tip disabled', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('does not register the command that edits system-wide shortcuts', () => {
		assert.strictEqual(CommandsRegistry.getCommand('sessions.action.enableOpenAgentsWindowSystemWideKeybinding'), undefined);
	});
});
