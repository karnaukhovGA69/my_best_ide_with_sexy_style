/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IMcpServer } from './mcpTypes.js';
import { MCP } from './modelContextProtocol.js';

export interface ISamplingStoredData {
	// UTC day ordinal of the first bin in the bins
	head: number;
	// Requests per day in the legacy log
	bins: number[];
	// Last sampling requests/responses
	lastReqs: { request: MCP.SamplingMessage[]; response: string; at: number; model: string }[];
}

/** Compatibility surface for callers while built-in MCP sampling is removed. */
export class McpSamplingLog extends Disposable {
	public has(_server: IMcpServer): boolean {
		return false;
	}

	public get(_server: IMcpServer): Readonly<ISamplingStoredData | undefined> {
		return undefined;
	}

	public getAsText(_server: IMcpServer): string {
		return '';
	}

	public async add(_server: IMcpServer, _request: MCP.SamplingMessage[], _response: string, _model: string): Promise<void> {
		// Sampling logs are disabled. Do not access storage or retain request data.
	}
}
