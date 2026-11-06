/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { type CustomizationMarketplaceInstallation } from '../../../../platform/customizationMarketplace/common/customizationMarketplaceService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { CustomizationMarketplaceInstallOrigin } from './customizationMarketplaceInstallService.js';

export type CustomizationMarketplaceInstallSurface = 'marketplace' | 'available';
export type CustomizationMarketplaceInstallType = 'skill' | 'mcpServer' | 'plugin' | 'connector' | 'unknown';
export type CustomizationMarketplaceInstallKind = CustomizationMarketplaceInstallation['kind'] | 'unknown';

export interface ICustomizationMarketplaceInstallTelemetryContext {
	readonly surface: CustomizationMarketplaceInstallSurface;
	readonly customizationType: CustomizationMarketplaceInstallType;
	readonly installKind: CustomizationMarketplaceInstallKind;
	readonly origin: CustomizationMarketplaceInstallOrigin;
}

export type AvailableCustomizationMarketplaceInstallType = 'mcpServer' | 'plugin';

/** Maps validated marketplace installation provenance to bounded telemetry categories. */
export function getCustomizationMarketplaceInstallTelemetryContext(
	surface: CustomizationMarketplaceInstallSurface,
	installation: CustomizationMarketplaceInstallation | undefined,
	origin: CustomizationMarketplaceInstallOrigin = 'search',
): ICustomizationMarketplaceInstallTelemetryContext {
	if (!installation) {
		return { surface, customizationType: 'unknown', installKind: 'unknown', origin };
	}
	switch (installation.kind) {
		case 'skill':
			return { surface, customizationType: 'skill', installKind: installation.kind, origin };
		case 'mcp':
		case 'mcpGallery':
			return { surface, customizationType: 'mcpServer', installKind: installation.kind, origin };
		case 'plugin':
		case 'configuredPlugin':
		case 'providerPlugin':
			return { surface, customizationType: 'plugin', installKind: installation.kind, origin };
		case 'providerCatalog':
			return {
				surface,
				customizationType: installation.resourceKind === 'mcp' ? 'mcpServer' : installation.resourceKind,
				installKind: installation.kind,
				origin,
			};
		case 'copilotConnector':
			return { surface, customizationType: 'connector', installKind: installation.kind, origin };
	}
}

/** Returns the categories corresponding to the legacy MCP and plugin Available sections. */
export function getAvailableCustomizationMarketplaceInstallTelemetryContext(
	customizationType: AvailableCustomizationMarketplaceInstallType,
): ICustomizationMarketplaceInstallTelemetryContext {
	return customizationType === 'mcpServer'
		? { surface: 'available', customizationType, installKind: 'mcpGallery', origin: 'search' }
		: { surface: 'available', customizationType, installKind: 'configuredPlugin', origin: 'search' };
}

/** Preserves operation behavior without collecting installation analytics. */
export async function runCustomizationMarketplaceInstallWithTelemetry(
	_telemetryService: ITelemetryService,
	_context: ICustomizationMarketplaceInstallTelemetryContext,
	operation: () => Promise<void>,
	_token: CancellationToken = CancellationToken.None,
): Promise<void> {
	await operation();
}
