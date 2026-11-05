/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import type { IMcpGatewayInfo, IMcpGatewayService, IMcpGatewayToolInvoker } from '../common/mcpGateway.js';

/** Preserves main/remote service registration without an HTTP server or tool routes. */
export class McpGatewayService extends Disposable implements IMcpGatewayService {
	declare readonly _serviceBrand: undefined;

	async createGateway(_clientId: unknown, _toolInvoker?: IMcpGatewayToolInvoker): Promise<IMcpGatewayInfo> {
		throw new Error(localize('mcpUnavailable', "MCP is not available in this edition of the editor."));
	}

	async disposeGateway(_gatewayId: string): Promise<void> {
		// No gateways exist; cleanup of a stale handle remains safe.
	}

	disposeGatewaysForClient(_clientId: unknown): void { }
}
