/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../nls.js';
import { ILogger } from '../../log/common/log.js';

/** Compatibility entry point for CLI callers while built-in MCP is removed. */
export class McpManagementCli {
	constructor(_logger: ILogger) { }

	async addMcpDefinitions(_definitions: string[]): Promise<void> {
		throw new Error(localize('mcp.disabled', "MCP is not available in this IDE."));
	}
}
