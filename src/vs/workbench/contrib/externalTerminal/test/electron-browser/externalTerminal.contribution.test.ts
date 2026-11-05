/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { IExternalTerminalService } from '../../../../../platform/externalTerminal/electron-browser/externalTerminalService.js';
import { IExternalTerminalSettings } from '../../../../../platform/externalTerminal/common/externalTerminal.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IRemoteAuthorityResolverService } from '../../../../../platform/remote/common/remoteAuthorityResolver.js';
import { IWorkspace, IWorkspaceContextService, IWorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import '../../electron-browser/externalTerminal.contribution.js';

suite('ExternalTerminal contribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let openTerminalCalls: { cwd: string | undefined }[];
	let pickCalls: IQuickPickItem[][];

	function createWorkspaceFolder(uri: URI, name: string, index: number): IWorkspaceFolder {
		return {
			uri,
			name,
			index,
			toResource: (relativePath: string) => URI.joinPath(uri, relativePath)
		};
	}

	function setupServices(options: {
		folders: IWorkspaceFolder[];
		lastActiveRoot?: URI;
		lastActiveFile?: URI;
		pickedFolder?: IWorkspaceFolder | undefined;
		canonicalUri?: URI;
		canonicalError?: Error;
		launch?: () => Promise<void>;
	}) {
		instantiationService = store.add(new TestInstantiationService());

		openTerminalCalls = [];
		pickCalls = [];

		instantiationService.stub(IHistoryService, new class extends mock<IHistoryService>() {
			override getLastActiveWorkspaceRoot() {
				return options.lastActiveRoot;
			}
			override getLastActiveFile(_schemeFilter: string) {
				return options.lastActiveFile?.scheme === _schemeFilter ? options.lastActiveFile : undefined;
			}
		});

		instantiationService.stub(IExternalTerminalService, new class extends mock<IExternalTerminalService>() {
			override async openTerminal(_config: IExternalTerminalSettings, cwd: string | undefined) {
				openTerminalCalls.push({ cwd });
				await options.launch?.();
			}
		});

		instantiationService.stub(IConfigurationService, new TestConfigurationService({
			terminal: { external: { linuxExec: 'xterm', osxExec: 'Terminal.app', windowsExec: 'cmd' } }
		}));

		instantiationService.stub(IRemoteAuthorityResolverService, new class extends mock<IRemoteAuthorityResolverService>() {
			override async getCanonicalURI(uri: URI): Promise<URI> {
				if (options.canonicalError) {
					throw options.canonicalError;
				}
				return options.canonicalUri ?? uri;
			}
		});

		instantiationService.stub(IWorkspaceContextService, new class extends mock<IWorkspaceContextService>() {
			override getWorkspace(): IWorkspace {
				return {
					id: 'test-workspace',
					folders: options.folders,
				};
			}
		});

		instantiationService.stub(IQuickInputService, new class extends mock<IQuickInputService>() {
			override async pick<T extends IQuickPickItem>(picks: T[]): Promise<T | undefined> {
				pickCalls.push(picks);
				if (options.pickedFolder) {
					const index = options.folders.indexOf(options.pickedFolder);
					return picks[index];
				}
				return undefined;
			}
		});

		instantiationService.stub(ILabelService, new class extends mock<ILabelService>() {
			override getUriLabel(uri: URI) {
				return uri.fsPath;
			}
		});
	}

	test('single folder - uses last active workspace root', async () => {
		const folderUri = URI.file('/workspace/project');
		const folder = createWorkspaceFolder(folderUri, 'project', 0);

		setupServices({
			folders: [folder],
			lastActiveRoot: folderUri,
		});

		const handler = CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler;
		await instantiationService.invokeFunction(handler);

		assert.deepStrictEqual(openTerminalCalls, [{ cwd: folderUri.fsPath }]);
		assert.deepStrictEqual(pickCalls, []);
	});

	test('multiple folders - shows picker and opens selected folder', async () => {
		const folder1Uri = URI.file('/workspace/project1');
		const folder2Uri = URI.file('/workspace/project2');
		const folder1 = createWorkspaceFolder(folder1Uri, 'project1', 0);
		const folder2 = createWorkspaceFolder(folder2Uri, 'project2', 1);

		setupServices({
			folders: [folder1, folder2],
			pickedFolder: folder2,
		});

		const handler = CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler;
		await instantiationService.invokeFunction(handler);

		assert.strictEqual(pickCalls.length, 1);
		assert.deepStrictEqual(openTerminalCalls, [{ cwd: folder2Uri.fsPath }]);
	});

	test('multiple folders - picker cancelled does not open terminal', async () => {
		const folder1Uri = URI.file('/workspace/project1');
		const folder2Uri = URI.file('/workspace/project2');
		const folder1 = createWorkspaceFolder(folder1Uri, 'project1', 0);
		const folder2 = createWorkspaceFolder(folder2Uri, 'project2', 1);

		setupServices({
			folders: [folder1, folder2],
			pickedFolder: undefined,
		});

		const handler = CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler;
		await instantiationService.invokeFunction(handler);

		assert.strictEqual(pickCalls.length, 1);
		assert.deepStrictEqual(openTerminalCalls, []);
	});

	test('no workspace root - falls back to active file directory', async () => {
		const fileUri = URI.file('/workspace/project/src/file.ts');
		const expectedDir = URI.file('/workspace/project/src').fsPath;

		setupServices({
			folders: [],
			lastActiveRoot: undefined,
			lastActiveFile: fileUri,
		});

		const handler = CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler;
		await instantiationService.invokeFunction(handler);

		assert.deepStrictEqual(openTerminalCalls, [{ cwd: expectedDir }]);
	});

	test('no workspace, no file - opens terminal without cwd', async () => {
		setupServices({
			folders: [],
			lastActiveRoot: undefined,
			lastActiveFile: undefined,
		});

		const handler = CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler;
		await instantiationService.invokeFunction(handler);

		assert.deepStrictEqual(openTerminalCalls, [{ cwd: undefined }]);
	});

	test('external terminal is available from the Terminal menu', () => {
		const commands = MenuRegistry.getMenuItems(MenuId.MenubarTerminalMenu).filter(isIMenuItem).map(item => item.command.id);
		assert.ok(commands.includes('workbench.action.terminal.openNativeConsole'));
	});

	test('fresh single folder - uses workspace folder before file history', async () => {
		const folder = createWorkspaceFolder(URI.file('/workspace/fresh'), 'fresh', 0);
		setupServices({ folders: [folder], lastActiveFile: URI.file('/other/file.ts') });
		await instantiationService.invokeFunction(CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler);
		assert.deepStrictEqual(openTerminalCalls, [{ cwd: folder.uri.fsPath }]);
		assert.deepStrictEqual(pickCalls, []);
	});

	test('remote workspace - opens local canonical root', async () => {
		const local = URI.file('/local/project');
		setupServices({ folders: [], lastActiveRoot: URI.from({ scheme: Schemas.vscodeRemote, authority: 'test', path: '/project' }), canonicalUri: local });
		await instantiationService.invokeFunction(CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler);
		assert.deepStrictEqual(openTerminalCalls, [{ cwd: local.fsPath }]);
	});

	test('remote file - opens directory of local canonical file', async () => {
		setupServices({ folders: [], lastActiveFile: URI.from({ scheme: Schemas.vscodeRemote, authority: 'test', path: '/project/file.ts' }), canonicalUri: URI.file('/local/project/file.ts') });
		await instantiationService.invokeFunction(CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler);
		assert.deepStrictEqual(openTerminalCalls, [{ cwd: URI.file('/local/project').fsPath }]);
	});

	test('canonical resolution failure - falls back to local file', async () => {
		setupServices({ folders: [], lastActiveRoot: URI.from({ scheme: Schemas.vscodeRemote, authority: 'test', path: '/project' }), canonicalError: new Error('Unavailable'), lastActiveFile: URI.file('/local/file.ts') });
		await instantiationService.invokeFunction(CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler);
		assert.deepStrictEqual(openTerminalCalls, [{ cwd: URI.file('/local').fsPath }]);
	});

	test('remote-only canonical path - falls back to home', async () => {
		setupServices({ folders: [], lastActiveFile: URI.from({ scheme: Schemas.vscodeRemote, authority: 'test', path: '/project/file.ts' }) });
		await instantiationService.invokeFunction(CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler);
		assert.deepStrictEqual(openTerminalCalls, [{ cwd: undefined }]);
	});

	for (const source of ['root', 'file', 'home', 'remoteRoot', 'remoteFile'] as const) {
		test(`${source} - waits for launch and propagates failure without retry`, async () => {
			const pending = new DeferredPromise<void>();
			const started = new DeferredPromise<void>();
			const local = URI.file('/workspace/project');
			const remote = URI.from({ scheme: Schemas.vscodeRemote, authority: 'test', path: '/project' });
			setupServices({
				folders: [],
				lastActiveRoot: source === 'root' ? local : source === 'remoteRoot' ? remote : undefined,
				lastActiveFile: source === 'file' ? local : source === 'remoteFile' ? remote : undefined,
				canonicalUri: local,
				launch: async () => {
					await started.complete();
					return pending.p;
				}
			});
			let settled = false;
			const result = Promise.resolve(instantiationService.invokeFunction(CommandsRegistry.getCommand('workbench.action.terminal.openNativeConsole')!.handler));
			const observed = result.then(() => { settled = true; }, () => { settled = true; });
			await started.p;
			await Promise.resolve();
			assert.strictEqual(settled, false);
			const error = new Error('Terminal executable unavailable');
			const rejected = assert.rejects(result, error);
			await pending.error(error);
			await rejected;
			await observed;
			assert.strictEqual(openTerminalCalls.length, 1);
		});
	}

});
