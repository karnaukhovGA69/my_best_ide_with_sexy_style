/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../../../../base/test/common/mock.js';
import type { ICodeEditor } from '../../../../../../../../editor/browser/editorBrowser.js';
import type { IConfigurationService } from '../../../../../../../../platform/configuration/common/configuration.js';
import { bindChatInputInlineSuggestions } from '../../../../../browser/widget/input/editor/chatInputInlineSuggestions.js';

suite('Chat input automatic suggestions disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	test('disables only inline suggestions without reading or observing settings', () => {
		const updates: unknown[] = [];
		const editor = upcastPartial<ICodeEditor>({ updateOptions: options => updates.push(options) });
		const configuration = new Proxy({} as IConfigurationService, { get: () => { throw new Error('Configuration must not be read'); } });
		const binding = store.add(bindChatInputInlineSuggestions(editor, configuration));
		binding.dispose();
		assert.deepStrictEqual(updates, [{ inlineSuggest: { enabled: false } }]);
	});
});
