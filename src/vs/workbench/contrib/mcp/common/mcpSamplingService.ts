/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import type { IMcpServerSamplingConfiguration } from './mcpConfiguration.js';
import { type IMcpSamplingService, type IMcpServer, type ISamplingOptions, type ISamplingResult, McpError } from './mcpTypes.js';

/** Keeps existing consumers compatible without model requests, prompts or sampling logs. */
export class McpSamplingService extends Disposable implements IMcpSamplingService {
	declare readonly _serviceBrand: undefined;

	async sample(_opts: ISamplingOptions, _token?: CancellationToken): Promise<ISamplingResult> {
		throw new McpError(-32000, localize('mcpSamplingUnavailable', "MCP sampling is not available in this edition of the editor."));
	}

	hasLogs(_server: IMcpServer): boolean {
		return false;
	}

	getLogText(_server: IMcpServer): string {
		return '';
	}

	getConfig(_server: IMcpServer): IMcpServerSamplingConfiguration {
		// A fresh denied configuration cannot retain caller mutations or expose old permissions.
		return { allowedDuringChat: false, allowedOutsideChat: false, allowedModels: [] };
	}

	async updateConfig(_server: IMcpServer, _mutate: (r: IMcpServerSamplingConfiguration) => unknown): Promise<IMcpServerSamplingConfiguration> {
		throw new McpError(-32000, localize('mcpSamplingUnavailable', "MCP sampling is not available in this edition of the editor."));
	}
}
