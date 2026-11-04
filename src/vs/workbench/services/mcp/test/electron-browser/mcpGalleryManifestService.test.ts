/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IMcpGalleryManifestService, McpGalleryManifestStatus } from '../../../../../platform/mcp/common/mcpGalleryManifest.js';
import { WorkbenchMcpGalleryManifestService } from '../../browser/mcpGalleryManifestService.js';
import { McpGalleryManifestService } from '../../electron-browser/mcpGalleryManifestService.js';

suite('Workbench MCP gallery unavailable in Myself IDE', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const [label, ctor] of [['web', WorkbenchMcpGalleryManifestService], ['desktop', McpGalleryManifestService]] as const) {
		test(`${label} resolves without configuration, remote or shared-process services`, async () => {
			const instantiationService = store.add(new InstantiationService());
			const service = store.add(instantiationService.createInstance(ctor));
			assert.deepStrictEqual({
				manifest: await service.getMcpGalleryManifest(),
				defaultManifest: await service.getDefaultMcpGalleryManifest(),
				status: service.mcpGalleryManifestStatus,
			}, { manifest: null, defaultManifest: null, status: McpGalleryManifestStatus.Unavailable });
		});
	}

	test('desktop singleton remains resolvable by existing DI consumers', async () => {
		const registration = getSingletonServiceDescriptors().find(([id]) => id === IMcpGalleryManifestService);
		assert.ok(registration);
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(registration)));
		const service = instantiationService.invokeFunction(accessor => accessor.get(IMcpGalleryManifestService));
		assert.strictEqual(await service.getMcpGalleryManifest(), null);
	});
});
