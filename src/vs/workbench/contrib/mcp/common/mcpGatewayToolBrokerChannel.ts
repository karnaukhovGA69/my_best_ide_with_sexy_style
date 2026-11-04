/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { localize } from '../../../../nls.js';
import type { ILogService } from '../../../../platform/log/common/log.js';
import type { IMcpService } from './mcpTypes.js';

/** Compatibility IPC endpoint with no MCP inventory, subscriptions or executable operations. */
export class McpGatewayToolBrokerChannel extends Disposable implements IServerChannel<unknown> {
	constructor(_mcpService?: IMcpService, _logService?: ILogService, _startupGracePeriodMs?: number) {
		super();
	}

	listen<T>(_ctx: unknown, event: string): Event<T> {
		switch (event) {
			case 'onDidChangeTools':
			case 'onDidChangeResources':
			case 'onDidChangeServers':
				return Event.None;
		}
		throw new Error(`Invalid listen: ${event}`);
	}

	async call<T>(_ctx: unknown, command: string, _arg?: unknown, _cancellationToken?: CancellationToken): Promise<T> {
		switch (command) {
			case 'listServers':
			case 'listToolsForServer':
			case 'listResourcesForServer':
			case 'listResourceTemplatesForServer':
				return [] as T;
			case 'callToolForServer':
			case 'readResourceForServer':
				throw new Error(localize('mcp.broker.disabled', 'MCP gateway tool and resource access is disabled in Myself IDE.'));
		}
		throw new Error(`Invalid call: ${command}`);
	}
}
