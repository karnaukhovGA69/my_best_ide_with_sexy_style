/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { IMcpServer, McpServerDefinition, McpServerLaunch } from './mcpTypes.js';

/** Retains the server attachment lifecycle without auto-start, restart or file watchers. */
export class McpDevModeServerAttache extends Disposable {
	constructor(_server: IMcpServer, _fwdRef: { lastModeDebugged: boolean }) {
		super();
		// Do not read definitions or subscribe to server, registry or workspace state.
	}
}

export interface IMcpDevModeDebugging {
	readonly _serviceBrand: undefined;

	transform(definition: McpServerDefinition, launch: McpServerLaunch): Promise<McpServerLaunch>;
}

export const IMcpDevModeDebugging = createDecorator<IMcpDevModeDebugging>('mcpDevModeDebugging');

/** Keeps the MCP-specific debug adapter contract without activating a debugger. */
export class McpDevModeDebugging implements IMcpDevModeDebugging {
	declare readonly _serviceBrand: undefined;

	async transform(_definition: McpServerDefinition, _launch: McpServerLaunch): Promise<McpServerLaunch> {
		throw new Error(localize('mcpDebuggingUnavailable', "MCP debugging is not available in this edition of the editor."));
	}
}
