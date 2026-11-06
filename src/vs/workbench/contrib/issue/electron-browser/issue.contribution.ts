/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IProcessService } from '../../../../platform/process/common/process.js';
import './issueService.js';
import '../common/issue.contribution.js';

CommandsRegistry.registerCommand('_issues.getSystemStatus', accessor => {
	return accessor.get(IProcessService).getSystemStatus();
});
