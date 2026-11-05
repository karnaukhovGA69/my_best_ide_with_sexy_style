/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { constObservable, IObservable } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { IMcpToolCallUIData } from '../common/mcpTypes.js';
import { MCP } from '../common/modelContextProtocol.js';
import { McpApps } from '../common/modelContextProtocolApps.js';

/** Result type retained for the remaining MCP App renderer. */
export interface IMcpAppResourceContent extends McpApps.McpUiResourceMeta {
	readonly html: string;
	readonly mimeType: string;
}

/** Compatibility facade; MCP App transports are unavailable in Myself IDE. */
export class McpToolCallUI extends Disposable {
	public readonly hostContext: IObservable<McpApps.McpUiHostContext> = constObservable(Object.freeze({}));
	public readonly onNotification: Event<{ readonly method: string; readonly params?: unknown }> = Event.None;

	constructor(private readonly _uiData: IMcpToolCallUIData) {
		super();
	}

	public get uiData(): IMcpToolCallUIData {
		return this._uiData;
	}

	public async log(_log: MCP.LoggingMessageNotificationParams): Promise<void> {
		// Late one-way notifications are ignored without resolving a server or connection.
	}

	public async loadResource(_token: CancellationToken): Promise<IMcpAppResourceContent> {
		throw new Error(localize('mcp.apps.disabled', "MCP Apps are disabled in Myself IDE."));
	}

	public async callTool(_params: MCP.CallToolRequestParams, _token: CancellationToken): Promise<MCP.CallToolResult> {
		throw new Error(localize('mcp.apps.disabled', "MCP Apps are disabled in Myself IDE."));
	}

	public async readResource(_uri: string, _token: CancellationToken): Promise<MCP.ReadResourceResult> {
		throw new Error(localize('mcp.apps.disabled', "MCP Apps are disabled in Myself IDE."));
	}

	public async sampling(_params: MCP.CreateMessageRequest['params'], _token: CancellationToken): Promise<MCP.CreateMessageResult> {
		throw new Error(localize('mcp.apps.disabled', "MCP Apps are disabled in Myself IDE."));
	}
}
