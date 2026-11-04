/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';
import { type ElicitResult, type IMcpElicitationService, type IMcpServer, type IMcpToolCallContext, McpError } from '../common/mcpTypes.js';
import type { MCP } from '../common/modelContextProtocol.js';

/** Keeps MCP callers compatible without forms, chat prompts, notifications or URL opening. */
export class McpElicitationService implements IMcpElicitationService {
	declare readonly _serviceBrand: undefined;

	async elicit(_server: IMcpServer, _context: IMcpToolCallContext | undefined, _elicitation: MCP.ElicitRequest['params'], _token: CancellationToken): Promise<ElicitResult> {
		throw new McpError(-32000, localize('mcpElicitationUnavailable', "MCP elicitation is not available in this edition of the editor."));
	}
}
