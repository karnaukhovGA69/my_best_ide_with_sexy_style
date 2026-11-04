/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { Event } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import type { URI, UriComponents } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import type { IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import type { McpServerPolicyValues } from '../../../platform/mcp/common/allowedMcpServers.js';
import type { McpServerDefinition, McpServerEnvironmentVariableExpansion, McpServerLaunch } from '../../contrib/mcp/common/mcpTypes.js';
import type { ExtHostMcpShape, IStartMcpOptions } from './extHost.protocol.js';

export const IExtHostMpcService = createDecorator<IExtHostMpcService>('IExtHostMpcService');

export interface IExtHostMpcService extends ExtHostMcpShape {
	registerMcpConfigurationProvider(extension: IExtensionDescription, id: string, provider: vscode.McpServerDefinitionProvider): IDisposable;
	readonly onDidChangeMcpServerDefinitions: Event<void>;
	readonly mcpServerDefinitions: readonly vscode.McpServerDefinition[];
	startMcpGateway(chatSessionResource?: URI): Promise<vscode.McpGateway | undefined>;
}

/** Retains the extension API contract without providers, transports or background RPC. */
export class ExtHostMcpService extends Disposable implements IExtHostMpcService {
	readonly onDidChangeMcpServerDefinitions = Event.None;
	readonly mcpServerDefinitions: readonly vscode.McpServerDefinition[] = Object.freeze([]);

	registerMcpConfigurationProvider(_extension: IExtensionDescription, _id: string, _provider: vscode.McpServerDefinitionProvider): IDisposable {
		// MCP may be an optional feature of an otherwise useful extension. Do not
		// inspect, subscribe to or retain its provider while allowing activation.
		return Disposable.None;
	}

	async startMcpGateway(_chatSessionResource?: URI): Promise<vscode.McpGateway | undefined> {
		throw new Error(localize('mcpUnavailable', "MCP is not available in this edition of the editor."));
	}

	$startMcp(_id: number, _opts: IStartMcpOptions): void {
		throw new Error(localize('mcpUnavailable', "MCP is not available in this edition of the editor."));
	}

	$sendMessage(_id: number, _message: string): void {
		throw new Error(localize('mcpUnavailable', "MCP is not available in this edition of the editor."));
	}

	$stopMcp(_id: number): void {
		// No transport exists; stopping an old handle remains safe and idempotent.
	}

	async $waitForInitialCollectionProviders(): Promise<void> {
		// No providers or scheduled callbacks to wait for.
	}

	async $resolveMcpLaunch(_collectionId: string, _label: string): Promise<McpServerLaunch.Serialized | undefined> {
		return undefined;
	}

	async $substituteVariables(_workspaceFolder: UriComponents | undefined, value: McpServerLaunch.Serialized): Promise<McpServerLaunch.Serialized> {
		// Compatibility only: do not query workspace variables, prompt or read files.
		return value;
	}

	async $expandEnvironmentVariables(launch: McpServerLaunch.Serialized, _expansion: McpServerEnvironmentVariableExpansion): Promise<McpServerLaunch.Serialized> {
		return launch;
	}

	async $resolveMcpPolicyVariables(values: readonly string[]): Promise<McpServerPolicyValues> {
		// Preserve unresolved matcher strings without reading the host environment.
		return Object.fromEntries(values.map(value => [value, value]));
	}

	$onDidChangeMcpServerDefinitions(_servers: McpServerDefinition.Serialized[]): void {
		// Late messages cannot repopulate the API's empty inventory.
	}

	$onDidChangeGatewayServers(_gatewayId: string, _servers: { label: string; address: UriComponents }[]): void {
		// No gateway or event emitter is retained.
	}
}
