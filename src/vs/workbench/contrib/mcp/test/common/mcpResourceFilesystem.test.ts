/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IWebContentExtractorService } from '../../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { McpResourceFilesystem } from '../../common/mcpResourceFilesystem.js';
import { IMcpService } from '../../common/mcpTypes.js';

suite('Workbench - MCP - ResourceFilesystem disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const resource = URI.parse('mcp-resource://746573742D736572766572/https/example.invalid/resource.txt');

	function createServices() {
		const calls: string[] = [];
		const files = store.add(new FileService(store.add(new NullLogService())));
		store.add(files.onDidChangeFileSystemProviderRegistrations(e => calls.push(`provider:${e.scheme}:${e.added}`)));
		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[IFileService, files],
			[IMcpService, upcastPartial<IMcpService>({ get servers(): never {
				calls.push('mcp');
				throw new Error('Unexpected MCP service access');
			} })],
			[IWebContentExtractorService, upcastPartial<IWebContentExtractorService>({ extract: async () => {
				calls.push('extract');
				throw new Error('Unexpected web content extraction');
			} })],
		), true));
		return { files, calls, instantiation };
	}

	test('startup and disposal require no infrastructure services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const contribution = store.add(instantiation.createInstance(McpResourceFilesystem));
		contribution.dispose();
		contribution.dispose();
	});

	test('startup, provider activation and disposal do not register an MCP provider', async () => {
		const { files, calls, instantiation } = createServices();
		const contribution = store.add(instantiation.createInstance(McpResourceFilesystem));
		await files.activateProvider(resource.scheme);
		const hasProvider = files.hasProvider(resource);
		contribution.dispose();
		assert.deepStrictEqual({ hasProvider, calls, providers: [...files.listCapabilities()] }, { hasProvider: false, calls: [], providers: [] });
	});

	for (const operation of ['readFile', 'readFileStream', 'stat'] as const) {
		test(`${operation} of a saved MCP URI fails without MCP or web extraction`, async () => {
			const { files, calls, instantiation } = createServices();
			store.add(instantiation.createInstance(McpResourceFilesystem));
			const outcome = await files[operation](resource).then(
				() => 'Unexpected resource access',
				error => error instanceof Error && error.message.includes('ENOPRO:') ? 'no provider' : String(error),
			);
			assert.deepStrictEqual({ outcome, calls }, { outcome: 'no provider', calls: [] });
		});
	}

	test('ordinary file operations remain available before and after contribution disposal', async () => {
		const { files, calls, instantiation } = createServices();
		const memory = store.add(new InMemoryFileSystemProvider());
		store.add(files.registerProvider('inmemory', memory));
		calls.length = 0;
		const contribution = store.add(instantiation.createInstance(McpResourceFilesystem));
		const file = URI.from({ scheme: 'inmemory', path: '/notes.txt' });
		const renamed = URI.from({ scheme: 'inmemory', path: '/renamed.txt' });
		await files.writeFile(file, VSBuffer.fromString('Обычный текст'));
		const before = (await files.readFile(file)).value.toString();
		contribution.dispose();
		await files.move(file, renamed);
		await files.writeFile(renamed, VSBuffer.fromString('Updated text'));
		const after = (await files.readFile(renamed)).value.toString();
		await files.del(renamed);
		const exists = await files.exists(renamed);
		assert.deepStrictEqual({ before, after, exists, calls, hasProvider: files.hasProvider(file) }, {
			before: 'Обычный текст', after: 'Updated text', exists: false, calls: [], hasProvider: true,
		});
	});
});
