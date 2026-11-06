/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../../base/browser/dom.js';
import { Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { IChatMode } from '../../../common/chatModes.js';
import { IHandOff } from '../../../common/promptSyntax/promptFileParser.js';

export interface INextPromptSelection {
	readonly handoff: IHandOff;
	readonly agentId?: string;
	readonly withAutopilot?: boolean;
}

/** Compatibility surface for chat layout; suggested agent handoffs are disabled. */
export class ChatSuggestNextWidget extends Disposable {
	readonly domNode: HTMLElement;
	readonly onDidChangeHeight: Event<void> = Event.None;
	readonly onDidSelectPrompt: Event<INextPromptSelection> = Event.None;

	constructor() {
		super();
		this.domNode = dom.$('.chat-suggest-next-widget');
		this.domNode.style.display = 'none';
	}

	get height(): number { return 0; }
	getCurrentMode(): IChatMode | undefined { return undefined; }
	render(_mode: IChatMode): void { }
	hide(): void { }
}
