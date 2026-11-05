/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IMcpCopilotGlobalConfigurationService = createDecorator<IMcpCopilotGlobalConfigurationService>('mcpCopilotGlobalConfigurationService');

export interface IMcpCopilotGlobalConfigurationService {
	readonly _serviceBrand: undefined;
	/** Resolves the configuration on the window's agent-host machine, or undefined when unavailable. */
	getConfigurationResource(): Promise<URI | undefined>;
}

/** Keeps configuration callers compatible without local or remote Copilot discovery. */
export class McpCopilotGlobalConfigurationService implements IMcpCopilotGlobalConfigurationService {
	declare readonly _serviceBrand: undefined;

	async getConfigurationResource(): Promise<URI | undefined> {
		return undefined;
	}
}
