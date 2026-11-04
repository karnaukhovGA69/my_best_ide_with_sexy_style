/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import '../../browser/inlineChat.contribution.js';
import { EditorExtensionsRegistry } from '../../../../../editor/browser/editorExtensions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { UnavailableInlineChatSessionService, UnavailableInlineChatSessionResolver } from '../../browser/unavailableInlineChat.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('Myself IDE unavailable inline chat', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register an eager editor controller or inline chat commands', () => {
		assert.ok(!EditorExtensionsRegistry.getEditorContributions().some(c => c.id === 'editor.contrib.inlineChatController'));
		for (const id of ['inlineChat.start', 'inlineChat.askInChat', 'inlineChat.focus', 'inlineChat.fixDiagnostics', 'inlineChat2.keep', 'inlineChat2.close', 'inlineChat2.cancel']) {
			assert.strictEqual(CommandsRegistry.getCommand(id), undefined, id);
		}
	});

	test('cannot create or recover an AI session', async () => {
		const service = new UnavailableInlineChatSessionService();
		await assert.rejects(service.createSession(), /not available/);
		assert.strictEqual(service.getSessionByTextModel(), undefined);
		assert.strictEqual(service.getSessionBySessionUri(), undefined);
	});

	test('resolver cannot start local or Agent Host sessions', async () => {
		assert.strictEqual(await new UnavailableInlineChatSessionResolver().resolve(), undefined);
	});
});
