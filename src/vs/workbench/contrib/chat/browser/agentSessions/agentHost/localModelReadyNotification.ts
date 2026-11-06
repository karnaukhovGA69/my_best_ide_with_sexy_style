/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';

/** Compatibility contribution; local AI model ready offers are disabled. */
export class LocalModelReadyNotificationContribution extends Disposable { }

/** Kept for the existing contribution entrypoint; no offer commands are registered. */
export function registerLocalModelReadyOfferCommands(): void { }
