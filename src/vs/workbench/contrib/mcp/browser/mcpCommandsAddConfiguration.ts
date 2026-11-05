/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { IWorkspaceMcpConfigurationTarget } from './mcpConfigurationDestination.js';

export const enum AddConfigurationType {
	Stdio,
	HTTP,

	NpmPackage,
	PipPackage,
	NuGetPackage,
	DockerImage,
}

/** Configuration key retained for the shared chat configuration registration. */
export const AssistedTypes = {
	[AddConfigurationType.NuGetPackage]: { enabledConfigKey: 'chat.mcp.assisted.nuget.enabled' },
};

/** Compatibility entry point for the remaining Add Server action. */
export class McpAddConfigurationCommand {
	constructor(_configurationTarget: IWorkspaceMcpConfigurationTarget | undefined) { }

	public async run(): Promise<void> {
		throw new Error(localize('mcp.install.disabled', "MCP installation is disabled in Myself IDE."));
	}
}

/** Compatibility entry point for the remaining manifest installation action. */
export class McpInstallFromManifestCommand {
	async run(): Promise<void> {
		throw new Error(localize('mcp.install.disabled', "MCP installation is disabled in Myself IDE."));
	}
}
