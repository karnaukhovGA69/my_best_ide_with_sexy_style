/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';

export const DISMISSED_PROMOS_STORAGE_KEY = 'chat.dismissedPromoIds';
export const SEEN_PROMOS_STORAGE_KEY = 'chat.seenPromoIds';

/** Compatibility contribution; model promo notifications are disabled. */
export class ChatPromoNotificationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.chatPromoNotification';
}
