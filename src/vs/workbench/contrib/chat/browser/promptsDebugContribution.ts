/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';

/** Compatibility contribution; automatic AI prompt discovery logging is disabled. */
export class PromptsDebugContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.promptsDebug';
}
