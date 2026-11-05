/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import type { UriComponents } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import type { LogLevel } from '../../../platform/log/common/log.js';
import type { McpCollectionDefinition, McpConnectionState, McpServerDefinition } from '../../contrib/mcp/common/mcpTypes.js';
import { IExtHostContext, extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { MainContext, type IAuthMetadataSource, type IMcpAuthenticationDetails, type IMcpAuthenticationOptions, type MainThreadMcpShape } from '../common/extHost.protocol.js';

/** Keeps the named RPC endpoint without starting MCP or requesting authentication. */
@extHostNamedCustomer(MainContext.MainThreadMcp)
export class MainThreadMcp extends Disposable implements MainThreadMcpShape {
	constructor(_extHostContext: IExtHostContext) {
		super();
		// No proxy, registry delegate, authentication services, listeners or timers.
	}

	async $checkMcpServerAllowed(_id: number, _url: string): Promise<string | undefined> {
		return localize('mcpUnavailable', "MCP is not available in this edition of the editor.");
	}

	$upsertMcpCollection(_collection: McpCollectionDefinition.FromExtHost, _servers: McpServerDefinition.Serialized[]): void {
		// Ignore stale provider messages without retaining definitions.
	}

	$deleteMcpCollection(_collectionId: string): void { }
	$onDidChangeState(_id: number, _state: McpConnectionState): void { }
	$onDidPublishLog(_id: number, _level: LogLevel, _log: string): void { }
	$onDidReceiveMessage(_id: number, _message: string): void { }

	async $getTokenForProviderId(_id: number, _providerId: string, _scopes: string[], _options?: IMcpAuthenticationOptions): Promise<string | undefined> {
		return undefined;
	}

	async $getTokenFromServerMetadata(_id: number, _authDetails: IMcpAuthenticationDetails, _options?: IMcpAuthenticationOptions): Promise<string | undefined> {
		return undefined;
	}

	$logMcpAuthSetup(_data: IAuthMetadataSource): void { }

	async $startMcpGateway(_chatSessionResource?: UriComponents): Promise<{ servers: { label: string; address: UriComponents }[]; gatewayId: string } | undefined> {
		throw new Error(localize('mcpUnavailable', "MCP is not available in this edition of the editor."));
	}

	$disposeMcpGateway(_gatewayId: string): void { }
}
