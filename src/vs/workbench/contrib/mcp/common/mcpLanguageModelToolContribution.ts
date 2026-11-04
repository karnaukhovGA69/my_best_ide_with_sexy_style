/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';

/** Keeps the startup registration compatible without publishing or invoking MCP tools. */
export class McpLanguageModelToolContribution extends Disposable implements IWorkbenchContribution {
	public static readonly ID = 'workbench.contrib.mcp.languageModelTools';
}
