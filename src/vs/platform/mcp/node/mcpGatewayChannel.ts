/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { IPCServer, IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import { localize } from '../../../nls.js';
import type { ILoggerService } from '../../log/common/log.js';
import type { IMcpGatewayService } from '../common/mcpGateway.js';

/** Keeps existing IPC callers compatible without looking up a tool broker. */
export class McpGatewayChannel<TContext> extends Disposable implements IServerChannel<TContext> {
	constructor(_ipcServer: IPCServer<TContext>, _mcpGatewayService?: IMcpGatewayService, _loggerService?: ILoggerService) {
		super();
		// Accept the existing main-process arguments without retaining them. Remote
		// DI needs only the server argument; no services or listeners are requested.
	}

	listen<T>(_ctx: TContext, event: string): Event<T> {
		if (event === 'onDidChangeGatewayServers') {
			return Event.None;
		}
		throw new Error(`Invalid listen: ${event}`);
	}

	async call<T>(_ctx: TContext, command: string, _args?: unknown): Promise<T> {
		switch (command) {
			case 'createGateway':
				throw new Error(localize('mcpUnavailable', "MCP is not available in this edition of the editor."));
			case 'disposeGateway':
				// Stale clients can finish cleanup without invoking any backend.
				return undefined as T;
		}
		throw new Error(`Invalid call: ${command}`);
	}
}
