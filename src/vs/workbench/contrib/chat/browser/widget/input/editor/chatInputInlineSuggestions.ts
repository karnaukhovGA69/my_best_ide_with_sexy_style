/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../../../base/common/lifecycle.js';
import type { ICodeEditor } from '../../../../../../../editor/browser/editorBrowser.js';
import type { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';

export const chatInputInlineCompletionsSetting = 'github.copilot.completions.chat.enabled';

/** Built-in chat input never automatically queries inline suggestion providers. */
export function bindChatInputInlineSuggestions(editor: ICodeEditor, _configurationService: IConfigurationService): IDisposable {
	editor.updateOptions({ inlineSuggest: { enabled: false } });
	return Disposable.None;
}
