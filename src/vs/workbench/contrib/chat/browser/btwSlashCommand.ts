/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';

/** Compatibility contribution; the built-in AI side-chat slash command is disabled. */
export class BtwSlashCommandContribution extends Disposable {
	static readonly ID = 'workbench.contrib.btwSlashCommand';
}
