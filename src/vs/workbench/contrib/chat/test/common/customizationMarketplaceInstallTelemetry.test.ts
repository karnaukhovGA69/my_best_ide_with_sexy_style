/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getAvailableCustomizationMarketplaceInstallTelemetryContext, getCustomizationMarketplaceInstallTelemetryContext, runCustomizationMarketplaceInstallWithTelemetry } from '../../common/customizationMarketplaceInstallTelemetry.js';
import type { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';

suite('Customization marketplace install telemetry', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('maps every validated installation kind to bounded categories', () => {
		assert.deepStrictEqual([
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'skill', repository: 'owner/repository', ref: 'main', path: 'skills/demo' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'mcp', name: 'server', version: '1.0.0' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'mcpGallery', name: 'server', registry: 'default', registryUrl: 'https://registry.example' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'plugin', repository: 'owner/repository', ref: 'main', path: 'plugins/demo' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'configuredPlugin' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'providerPlugin', name: 'azure', marketplace: 'awesome-copilot' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'providerCatalog', resourceKind: 'skill', selectionId: 'selection' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'providerCatalog', resourceKind: 'mcp', selectionId: 'selection' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'providerCatalog', resourceKind: 'plugin', selectionId: 'selection' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', { kind: 'copilotConnector', name: 'mail' }),
			getCustomizationMarketplaceInstallTelemetryContext('marketplace', undefined),
			getAvailableCustomizationMarketplaceInstallTelemetryContext('mcpServer'),
			getAvailableCustomizationMarketplaceInstallTelemetryContext('plugin'),
		], [
			{ surface: 'marketplace', customizationType: 'skill', installKind: 'skill', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'mcpServer', installKind: 'mcp', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'mcpServer', installKind: 'mcpGallery', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'plugin', installKind: 'plugin', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'plugin', installKind: 'configuredPlugin', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'plugin', installKind: 'providerPlugin', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'skill', installKind: 'providerCatalog', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'mcpServer', installKind: 'providerCatalog', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'plugin', installKind: 'providerCatalog', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'connector', installKind: 'copilotConnector', origin: 'search' },
			{ surface: 'marketplace', customizationType: 'unknown', installKind: 'unknown', origin: 'search' },
			{ surface: 'available', customizationType: 'mcpServer', installKind: 'mcpGallery', origin: 'search' },
			{ surface: 'available', customizationType: 'plugin', installKind: 'configuredPlugin', origin: 'search' },
		]);
	});

	test('preserves success and original errors without accessing telemetry', async () => {
		const telemetry = new Proxy({} as ITelemetryService, { get: () => { throw new Error('Telemetry must not be read'); } });
		const context = getAvailableCustomizationMarketplaceInstallTelemetryContext('plugin');
		let calls = 0;
		await runCustomizationMarketplaceInstallWithTelemetry(telemetry, context, async () => { calls++; });
		assert.strictEqual(calls, 1);
		const token = store.add(new CancellationTokenSource());
		token.cancel();
		const original = new Error('operation failure');
		let caught: unknown;
		try {
			await runCustomizationMarketplaceInstallWithTelemetry(telemetry, context, async () => { calls++; throw original; }, token.token);
		} catch (error) { caught = error; }
		assert.strictEqual(caught, original);
		assert.strictEqual(calls, 2);
	});
});
