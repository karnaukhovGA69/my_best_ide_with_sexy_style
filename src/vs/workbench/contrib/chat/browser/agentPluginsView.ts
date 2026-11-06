/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';

/** Compatibility contribution; AI plugin marketplace views and actions are disabled. */
export class AgentPluginsViewsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.chat.agentPlugins.views.contribution';
}
