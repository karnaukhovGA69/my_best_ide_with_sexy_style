/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { constObservable, IObservable, observableValue } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import type { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { ILogger } from '../../../../platform/log/common/log.js';
import type { McpServerPolicyValues } from '../../../../platform/mcp/common/allowedMcpServers.js';
import type { IMcpHostDelegate } from './mcpRegistryTypes.js';
import type { McpServerRequestHandler } from './mcpServerRequestHandler.js';
import type { McpTaskManager } from './mcpTaskManager.js';
import { IMcpClientMethods, IMcpServerConnection, McpCollectionDefinition, McpConnectionState, McpServerDefinition, McpServerLaunch } from './mcpTypes.js';

/** Compatibility contract for remaining registry consumers; MCP transports are unavailable. */
export class McpServerConnection extends Disposable implements IMcpServerConnection {
	private readonly _state = observableValue<McpConnectionState>('mcpServerState', { state: McpConnectionState.Kind.Stopped });
	public readonly state: IObservable<McpConnectionState> = this._state;
	public readonly handler: IObservable<McpServerRequestHandler | undefined> = constObservable(undefined);
	public readonly onPotentialSandboxBlock = Event.None;

	constructor(
		_collection: McpCollectionDefinition,
		public readonly definition: McpServerDefinition,
		_delegate: IMcpHostDelegate,
		public readonly launchDefinition: McpServerLaunch,
		_logger: ILogger,
		_errorOnUserInteraction: boolean | undefined,
		_taskManager: McpTaskManager,
		_instantiationService?: IInstantiationService,
	) {
		super();
	}

	public async resolvePolicyVariables(_values: readonly string[]): Promise<McpServerPolicyValues> {
		throw new Error(localize('mcpServer.unavailable', 'MCP server connections are unavailable in this distribution.'));
	}

	public async start(_methods: IMcpClientMethods, _policyValues: McpServerPolicyValues): Promise<McpConnectionState> {
		if (this._store.isDisposed) {
			return this._state.get();
		}
		const state: McpConnectionState = {
			state: McpConnectionState.Kind.Error,
			message: localize('mcpServer.unavailable', 'MCP server connections are unavailable in this distribution.'),
		};
		this._state.set(state, undefined);
		return state;
	}

	public async stop(): Promise<void> {
		this._state.set({ state: McpConnectionState.Kind.Stopped }, undefined);
	}

	public override dispose(): void {
		super.dispose();
		this._state.set({ state: McpConnectionState.Kind.Stopped }, undefined);
	}
}
