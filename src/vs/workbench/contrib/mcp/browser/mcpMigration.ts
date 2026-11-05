/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';

/** Keeps the existing contribution registration compatible without migrating user settings. */
export class McpConfigMigrationContribution extends Disposable implements IWorkbenchContribution {
	static ID = 'workbench.mcp.config.migration';
}
