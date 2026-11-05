/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IMcpPrompt } from '../common/mcpTypes.js';

/** Compatibility entry point for the remaining MCP prompt action. */
export class McpPromptArgumentPick extends Disposable {
	constructor(_prompt: IMcpPrompt) {
		super();
	}

	public async createArgs(_token?: CancellationToken): Promise<Record<string, string | undefined> | undefined> {
		// Undefined follows the caller's cancellation path, including prompts without arguments.
		return undefined;
	}
}
