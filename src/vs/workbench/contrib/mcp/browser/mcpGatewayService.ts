/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import type { IMcpGatewayResult, IWorkbenchMcpGatewayService } from '../common/mcpGatewayService.js';

/** Compatibility service that rejects gateway creation without accessing IPC or remote services. */
export class BrowserMcpGatewayService implements IWorkbenchMcpGatewayService {
	declare readonly _serviceBrand: undefined;

	async createGateway(_inRemote: boolean, _chatSessionResource?: URI): Promise<IMcpGatewayResult | undefined> {
		throw new Error(localize('mcp.gateway.disabled', 'MCP gateways are disabled in Myself IDE.'));
	}
}
