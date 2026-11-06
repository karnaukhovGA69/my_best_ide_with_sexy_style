/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../../../common/contributions.js';

/** Compatibility contribution; automatic AI mode and picker activation is disabled. */
export class AgentHostModeSynchronizer extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.agentHostModeSynchronizer';
}
