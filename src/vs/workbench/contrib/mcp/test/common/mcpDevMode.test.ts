/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileChangesEvent, FileChangeType, IFileService } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IWorkspaceContextService, toWorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { McpDevModeDebugging, McpDevModeServerAttache } from '../../common/mcpDevMode.js';
import { IMcpHostDelegate, IMcpRegistry } from '../../common/mcpRegistryTypes.js';
import { IMcpServer, McpCollectionDefinition, McpServerDefinition, McpServerLaunch, McpServerTransportType } from '../../common/mcpTypes.js';

suite('Myself IDE disabled MCP development mode', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('server attachment needs no services and does not read caller state', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const server = new Proxy(new class extends mock<IMcpServer>() { }, {
			get() { throw new Error('Must not inspect or subscribe to an MCP server'); }
		});
		const ref = { get lastModeDebugged(): boolean { throw new Error('Must not read debug state'); } };
		const attachment = store.add(instantiation.createInstance(McpDevModeServerAttache, server, ref));
		attachment.dispose();
		attachment.dispose();
	});

	test('legacy watch/debug settings and file changes cannot start or restart servers', async () => {
		const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
		try {
			const root = URI.file('/fixture-workspace');
			const fileChanges = store.add(new Emitter<FileChangesEvent>());
			let starts = 0;
			let stops = 0;
			let watches = 0;
			const collection = upcastPartial<McpCollectionDefinition>({ presentation: { origin: URI.joinPath(root, '.vscode', 'mcp.json') } });
			const definition = upcastPartial<McpServerDefinition>({ devMode: { watch: ['mcp/*.mjs', '!mcp/excluded/**'] } });
			const definitions = observableValue('fixture definitions', { collection, server: definition });
			const server = upcastPartial<IMcpServer>({
				readDefinitions: () => definitions,
				start: async () => { starts++; return upcastPartial({}); },
				stop: async () => { stops++; },
			});
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			instantiation.stub(IFileService, {
				watch: () => { watches++; return Disposable.None; },
				hasCapability: () => false,
				onDidFilesChange: fileChanges.event,
			});
			instantiation.stub(IWorkspaceContextService, { getWorkspaceFolder: () => toWorkspaceFolder(root) });
			instantiation.stub(IMcpRegistry, { delegates: constObservable([upcastPartial<IMcpHostDelegate>({ canStart: () => true })]) });
			const attachment = store.add(instantiation.createInstance(McpDevModeServerAttache, server, { lastModeDebugged: true }));
			for (const debug of [{ type: 'node' } as const, { type: 'debugpy' } as const]) {
				definitions.set({ collection, server: { ...definition, devMode: { watch: 'mcp/**', debug } } }, undefined);
				fileChanges.fire(new FileChangesEvent([{ resource: URI.joinPath(root, 'mcp', 'server.mjs'), type: FileChangeType.UPDATED }], false));
				await Promise.resolve();
			}
			assert.deepStrictEqual({ starts, stops, watches, listeners: fileChanges.hasListeners(), timers: clock.countTimers() }, { starts: 0, stops: 0, watches: 0, listeners: false, timers: 0 });
			attachment.dispose();
			attachment.dispose();
		} finally {
			clock.restore();
		}
	});

	test('debug service constructs without debugger or command dependencies', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.createInstance(McpDevModeDebugging);
	});

	test('explicit transform rejects HTTP, Node and Python requests without changing the launch', async () => {
		const service = new McpDevModeDebugging();
		const launches: McpServerLaunch[] = [
			{ type: McpServerTransportType.HTTP, uri: URI.parse('https://example.invalid/mcp'), headers: [] },
			...[ 'node', 'python' ].map(command => ({ type: McpServerTransportType.Stdio as const, command, args: ['fixture'], cwd: undefined, env: {}, envFile: undefined, sandbox: undefined })),
		];
		for (const launch of launches) {
			const definition = new Proxy(new class extends mock<McpServerDefinition>() { }, {
				get() { throw new Error('Must not inspect debug settings'); }
			});
			const before = JSON.stringify(launch);
			await service.transform(definition, launch).then(
				() => assert.fail('MCP debugging must reject'),
				error => {
					assert.ok(error instanceof Error);
					assert.match(error.message, /MCP debugging is not available/);
				}
			);
			assert.strictEqual(JSON.stringify(launch), before);
		}
	});
});
