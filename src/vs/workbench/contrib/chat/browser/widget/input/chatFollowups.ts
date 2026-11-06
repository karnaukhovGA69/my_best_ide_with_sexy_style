/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IButtonStyles } from '../../../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import type { IChatFollowup } from '../../../common/chatService/chatService.js';
import type { ChatAgentLocation } from '../../../common/constants.js';

/** Compatibility renderer: built-in chat does not offer followup actions. */
export class ChatFollowups<T extends IChatFollowup> extends Disposable {
	constructor(_container: HTMLElement, _followups: T[], _location: ChatAgentLocation, _options: IButtonStyles | undefined, _clickHandler: (followup: T) => void) {
		super();
	}
}
