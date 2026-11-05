/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatSpeechToTextState, IChatSpeechToTextService } from '../speechToText/chatSpeechToTextService.js';
import { IDictationOnboardingService } from '../speechToText/dictationOnboarding.js';
import type { startDictation } from '../speechToText/dictationSession.js';

// Dictation is unavailable regardless of restored configuration or context keys.
export const ChatSpeechToTextConfigured = ContextKeyExpr.false();
export const ChatSpeechToTextPreparing = ContextKeyExpr.false();

export interface IDictationShortcutContext {
	readonly speechService: IChatSpeechToTextService;
	readonly keybindingService: IKeybindingService;
	readonly logService: ILogService;
	/**
	 * Supplied by chat inputs only. The first dictation started from one shows
	 * its introduction alongside recording; editor and terminal dictation have
	 * nowhere to dock the card.
	 */
	readonly onboardingService?: IDictationOnboardingService;
}

/** Resolves a toggle invocation against the current dictation lifecycle. */
export function getDictationShortcutOperation(dictating: boolean, state: ChatSpeechToTextState, preparingModel: boolean): 'start' | 'stop' | 'cancel' | undefined {
	if (dictating) {
		return preparingModel ? 'cancel' : 'stop';
	}
	return state === ChatSpeechToTextState.Idle ? 'start' : undefined;
}

/** Compatibility entry point; never starts a session or accesses an editor or service. */
export async function runDictationShortcut(
	_context: IDictationShortcutContext,
	_commandId: string,
	_editor: ICodeEditor,
	_startDictationFn?: typeof startDictation,
): Promise<void> { }

export class ToggleChatSpeechToTextAction extends Action2 {
	static readonly ID = 'workbench.action.chat.toggleSpeechToText';

	constructor() {
		super({
			id: ToggleChatSpeechToTextAction.ID,
			title: localize2('chat.speechToText.start', "Dictate (Speech to Text)"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor, ..._args: unknown[]): Promise<void> { }
}

export class ChatSpeechToTextPreparingAction extends Action2 {
	static readonly ID = 'workbench.action.chat.speechToTextPreparing';

	constructor() {
		super({
			id: ChatSpeechToTextPreparingAction.ID,
			title: localize2('chat.speechToText.preparing', "Preparing Speech to Text Model…"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	async run(): Promise<void> { }
}

export class ChatSpeechToTextConnectingAction extends Action2 {
	static readonly ID = 'workbench.action.chat.speechToTextConnecting';

	constructor() {
		super({
			id: ChatSpeechToTextConnectingAction.ID,
			title: localize2('chat.speechToText.connecting', "Connecting to Speech to Text…"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	async run(): Promise<void> { }
}

/** Preserve ownership semantics for callers without registering dictation commands or UI. */
export function registerChatSpeechToTextActions(): DisposableStore {
	return new DisposableStore();
}
