/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IChatTip, IChatTipProvider } from '../../../../workbench/contrib/chat/browser/chatTipService.js';

/** Compatibility provider; input is not inspected for connector recommendations. */
export class NewChatConnectorRecommendations extends Disposable implements IChatTipProvider {
	readonly onDidChange: Event<void> = Event.None;

	constructor(_options: { readonly getInputValue: () => string; readonly onDidChangeInputValue: Event<void> }, _random: () => number = Math.random) {
		super();
	}

	provideTip(): IChatTip | undefined { return undefined; }
	hasMultipleTips(): boolean { return false; }
	navigateTip(_direction: 1 | -1): IChatTip | undefined { return undefined; }
	dismissTip(_tipId: string): void { }
}
