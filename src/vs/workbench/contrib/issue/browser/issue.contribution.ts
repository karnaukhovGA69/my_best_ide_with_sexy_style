/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import './issueService.js';
import '../common/issue.contribution.js';

CommandsRegistry.registerCommand('_issues.getSystemStatus', () => {
	return localize('statusUnsupported', "The --status argument is not yet supported in browsers.");
});
