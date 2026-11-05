/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import type { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import type { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { IMcpSandboxConfiguration } from '../../../../platform/mcp/common/mcpPlatformTypes.js';
import type { IMcpPotentialSandboxBlock, McpServerDefinition, McpServerLaunch } from './mcpTypes.js';

export const IMcpSandboxService = createDecorator<IMcpSandboxService>('mcpSandboxService');

export interface IMcpSandboxService {
	readonly _serviceBrand: undefined;
	launchInSandboxIfEnabled(serverDef: McpServerDefinition, launch: McpServerLaunch, remoteAuthority: string | undefined, configTarget: ConfigurationTarget): Promise<McpServerLaunch>;
	isEnabled(serverDef: McpServerDefinition, serverLabel?: string): Promise<boolean>;
	getSandboxConfigSuggestionMessage(serverLabel: string, potentialBlocks: readonly IMcpPotentialSandboxBlock[], existingSandboxConfig?: IMcpSandboxConfiguration): SandboxConfigSuggestionResult | undefined;
	applySandboxConfigSuggestion(serverDef: McpServerDefinition, mcpResource: URI, configTarget: ConfigurationTarget, potentialBlocks: readonly IMcpPotentialSandboxBlock[], suggestedSandboxConfig?: IMcpSandboxConfiguration): Promise<boolean>;
}

type SandboxConfigSuggestionResult = {
	message: string;
	sandboxConfig: IMcpSandboxConfiguration;
};

/** Compatibility service that refuses MCP launches without preparing an unsandboxed fallback. */
export class McpSandboxService extends Disposable implements IMcpSandboxService {
	declare readonly _serviceBrand: undefined;

	public async isEnabled(_serverDef: McpServerDefinition, _remoteAuthority?: string): Promise<boolean> {
		return false;
	}

	public async launchInSandboxIfEnabled(_serverDef: McpServerDefinition, _launch: McpServerLaunch, _remoteAuthority: string | undefined, _configTarget: ConfigurationTarget): Promise<McpServerLaunch> {
		throw new Error(localize('mcp.launch.disabled', 'MCP server launches are disabled in Myself IDE.'));
	}

	public getSandboxConfigSuggestionMessage(_serverLabel: string, _potentialBlocks: readonly IMcpPotentialSandboxBlock[], _existingSandboxConfig?: IMcpSandboxConfiguration): SandboxConfigSuggestionResult | undefined {
		return undefined;
	}

	public async applySandboxConfigSuggestion(_serverDef: McpServerDefinition, _mcpResource: URI, _configTarget: ConfigurationTarget, _potentialBlocks: readonly IMcpPotentialSandboxBlock[], _suggestedSandboxConfig?: IMcpSandboxConfiguration): Promise<boolean> {
		return false;
	}
}
