/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { derived, observableValue } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IImageResizeService } from '../../../../../platform/imageResize/common/imageResizeService.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { ContributionEnablementState } from '../../../chat/common/enablement.js';
import { ILanguageModelToolsService, ToolSet } from '../../../chat/common/tools/languageModelToolsService.js';
import { McpLanguageModelToolContribution } from '../../common/mcpLanguageModelToolContribution.js';
import { IMcpRegistry } from '../../common/mcpRegistryTypes.js';
import { IMcpServer, IMcpService, IMcpTool, McpCollectionDefinition, McpToolVisibility } from '../../common/mcpTypes.js';

suite('Workbench - MCP - Language model tool contribution disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('startup and disposal require no infrastructure services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const contribution = store.add(instantiation.createInstance(McpLanguageModelToolContribution));
		contribution.dispose();
		contribution.dispose();
	});

	for (const initiallyPopulated of [false, true]) {
		test(`does not publish or observe tools with ${initiallyPopulated ? 'existing' : 'initially empty'} servers`, () => {
			const calls: string[] = [];
			const enablement = observableValue('enablement', ContributionEnablementState.EnabledProfile);
			const tool = upcastPartial<IMcpTool>({
				id: 'test-tool', referenceName: 'test-tool', visibility: McpToolVisibility.Model,
				definition: { name: 'test-tool', inputSchema: { type: 'object' } },
				icons: upcastPartial<IMcpTool['icons']>({ getUrl: () => undefined }),
				callWithProgress: async () => { calls.push('invoke'); throw new Error('Unexpected MCP tool invocation'); },
			});
			const tools = observableValue<readonly IMcpTool[]>('tools', [tool]);
			const server = upcastPartial<IMcpServer>({
				collection: upcastPartial<IMcpServer['collection']>({ id: 'test-collection' }),
				definition: upcastPartial<IMcpServer['definition']>({ id: 'test-server', label: 'Test server' }),
				enablement, tools,
				serverMetadata: observableValue('metadata', undefined),
			});
			const collection = upcastPartial<McpCollectionDefinition>({ id: 'test-collection', scope: StorageScope.PROFILE });
			const collections = observableValue<readonly McpCollectionDefinition[]>('collections', [collection]);
			const servers = observableValue<readonly IMcpServer[]>('servers', initiallyPopulated ? [server] : []);
			const services = new ServiceCollection(
				[IMcpService, upcastPartial<IMcpService>({ servers: derived(reader => {
					calls.push('read servers');
					return servers.read(reader);
				}) })],
				[IMcpRegistry, upcastPartial<IMcpRegistry>({ collections: derived(reader => {
					calls.push('read collections');
					return collections.read(reader);
				}) })],
				[ILanguageModelToolsService, upcastPartial<ILanguageModelToolsService>({
					registerTool: () => { calls.push('register tool'); return Disposable.None; },
					createToolSet: () => {
						calls.push('create tool set');
						return upcastPartial<ToolSet & IDisposable>({
							addTool: () => { calls.push('add tool'); return Disposable.None; },
							dispose: () => { calls.push('dispose tool set'); },
						});
					},
					flushToolUpdates: () => { calls.push('flush tools'); },
				})],
				[ILifecycleService, upcastPartial<ILifecycleService>({ willShutdown: false })],
				[IConfigurationService, upcastPartial<IConfigurationService>({})],
				[IProductService, upcastPartial<IProductService>({})],
				[IFileService, upcastPartial<IFileService>({})],
				[IImageResizeService, upcastPartial<IImageResizeService>({})],
			);
			const instantiation = store.add(new InstantiationService(services, true));
			const contribution = store.add(instantiation.createInstance(McpLanguageModelToolContribution));
			servers.set([server], undefined);
			tools.set([], undefined);
			tools.set([tool], undefined);
			enablement.set(ContributionEnablementState.DisabledProfile, undefined);
			enablement.set(ContributionEnablementState.EnabledProfile, undefined);
			collections.set([], undefined);
			collections.set([collection], undefined);
			servers.set([], undefined);
			contribution.dispose();
			servers.set([server], undefined);
			assert.deepStrictEqual(calls, []);
		});
	}
});
