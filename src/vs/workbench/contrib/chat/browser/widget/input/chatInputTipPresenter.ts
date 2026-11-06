/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import type { ChatInputNoticeHost } from './chatInputNoticeHost.js';
import { ChatInputStackSlot, setChatInputStackSlot } from './chatInputStack.js';

export interface IChatInputTipPresenterOptions {
	/** The element the tip is rendered into. Hidden while no tip is showing. */
	readonly container: HTMLElement;
	/** Decides whether this surface currently wants a tip at all. */
	readonly isEligible: () => boolean;
	/** Returns focus to the input once the tip removes itself. */
	readonly focusInput: () => void;
	/** Runs before every evaluation, for surfaces that must reset tip rotation. */
	readonly onBeforeUpdate?: () => void;
}


/** Compatibility adapter; built-in chat tips do not occupy notice lanes. */
export class ChatInputTipPresenter extends Disposable {
	get current(): undefined { return undefined; }

	constructor(options: IChatInputTipPresenterOptions, _noticeHost: ChatInputNoticeHost) {
		super();
		setChatInputStackSlot(options.container, ChatInputStackSlot.Empty);
	}

	update(): void { }
	clear(): void { }
}
