/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IWorkbenchContribution } from '../../../../common/contributions.js';

export const ctxIsGlobalEditingSession = new RawContextKey<boolean>('chatEdits.isGlobalEditingSession', undefined, localize('chat.ctxEditSessionIsGlobal', "The current editor is part of the global edit session"));
export const ctxHasEditorModification = new RawContextKey<boolean>('chatEdits.hasEditorModifications', undefined, localize('chat.hasEditorModifications', "The current editor contains chat modifications"));
export const ctxIsCurrentlyBeingModified = new RawContextKey<boolean>('chatEdits.isCurrentlyBeingModified', undefined, localize('chat.isCurrentlyBeingModified', "The current editor is currently being modified"));
export const ctxReviewModeEnabled = new RawContextKey<boolean>('chatEdits.isReviewModeEnabled', true, localize('chat.ctxReviewModeEnabled', "Review mode for chat changes is enabled"));
export const ctxHasRequestInProgress = new RawContextKey<boolean>('chatEdits.isRequestInProgress', false, localize('chat.ctxHasRequestInProgress', "The current editor shows a file from an edit session which is still in progress"));
export const ctxRequestCount = new RawContextKey<number>('chatEdits.requestCount', 0, localize('chatEdits.requestCount', "The number of turns the editing session in this editor has"));
export const ctxCursorInChangeRange = new RawContextKey<boolean>('chatEdits.cursorInChangeRange', false, localize('chat.ctxCursorInChangeRange', "The cursor is inside a change range made by chat editing."));

/** Compatibility contribution; AI editing session observation is disabled. */
export class ChatEditingEditorContextKeys extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'chat.edits.editorContextKeys';
}
