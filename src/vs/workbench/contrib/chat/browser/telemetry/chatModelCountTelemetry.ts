/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';

/** Compatibility class; no analytics or startup contribution is registered. */
export class ChatModelCountTelemetry extends Disposable {
	static readonly ID = 'workbench.contrib.chatModelCountTelemetry';
}
