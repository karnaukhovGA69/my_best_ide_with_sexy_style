/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, type IConfigurationChangeEvent, type IConfigurationOverrides, type IConfigurationValue } from '../../../../../platform/configuration/common/configuration.js';
import type { IContext } from '../../../../../platform/contextkey/common/contextkey.js';
import type { IPrompt, IPromptResult, IPromptResultWithCancel, IPromptWithCustomCancel } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { FileSystemProviderErrorCode, FileType, createFileSystemProviderError, type IStat } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { WorkbenchState, WorkspaceFolder, type IWorkspaceFoldersChangeEvent } from '../../../../../platform/workspace/common/workspace.js';
import { registerProjectReadinessAction } from '../../browser/projectReadiness.contribution.js';
import { pythonInterpreterKey } from '../../browser/projectReadinessCollector.js';
import { ProjectReadinessDialog } from '../../browser/projectReadinessDialog.js';

suite('Project readiness UI', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const first = localFolder('/workspace/first', 'Sample');
	const second = localFolder('/workspace/second', 'Sample', 1);
	const markerNames = ['pyproject.toml', 'requirements.txt', '.venv', 'CMakeLists.txt', 'Makefile', 'compile_commands.json'];

	function localFolder(path: string, name: string, index = 0): WorkspaceFolder {
		return new WorkspaceFolder({ uri: URI.file(isWindows ? `C:${path}` : path), name, index });
	}

	function fixture(statMarker: (resource: URI) => Promise<FileType> = async () => FileType.Unknown, initialFolders = [first], withProvider = true) {
		let folders = initialFolders;
		let trusted = true;
		let workbenchState = WorkbenchState.WORKSPACE;
		const rootsChanged = store.add(new Emitter<IWorkspaceFoldersChangeEvent>());
		const trustChanged = store.add(new Emitter<boolean>());
		const configurationChanged = store.add(new Emitter<IConfigurationChangeEvent>());
		const inspected: string[] = [];
		const settings = new Map<URI, IConfigurationValue<unknown> | Error>();
		const prompts: IPrompt<unknown>[] = [];
		const activations: string[] = [];
		const lookups: string[] = [];
		const operations: string[] = [];
		const stats: string[] = [];

		const configuration = {
			onDidChangeConfiguration: configurationChanged.event,
			inspect<T>(key: string, overrides?: IConfigurationOverrides): IConfigurationValue<Readonly<T>> {
				assert.strictEqual(key, pythonInterpreterKey);
				assert.ok(overrides?.resource);
				inspected.push(overrides.resource.toString());
				const setting = settings.get(overrides.resource);
				if (setting instanceof Error) {
					throw setting;
				}
				return (setting ?? {}) as IConfigurationValue<Readonly<T>>;
			},
		};
		const files = store.add(new class extends FileService {
			override getProvider(scheme: string) {
				lookups.push(scheme);
				return super.getProvider(scheme);
			}
		}(new NullLogService()));
		const provider = store.add(new class extends InMemoryFileSystemProvider {
			override async stat(resource: URI): Promise<IStat> {
				stats.push(resource.toString());
				return { type: await statMarker(resource), ctime: 0, mtime: 0, size: 0 };
			}
			override async readdir(): Promise<never> { operations.push('readdir'); throw new Error('Unexpected readdir'); }
			override async readFile(): Promise<never> { operations.push('readFile'); throw new Error('Unexpected read'); }
			override async writeFile(): Promise<never> { operations.push('writeFile'); throw new Error('Unexpected write'); }
			override watch(): never { operations.push('watch'); throw new Error('Unexpected watch'); }
		}());
		const registration = withProvider ? store.add(files.registerProvider(Schemas.file, provider)) : undefined;
		store.add(files.onWillActivateFileSystemProvider(event => activations.push(event.scheme)));
		const dialogs = new class extends TestDialogService {
			override prompt<T>(prompt: IPromptWithCustomCancel<T>): Promise<IPromptResultWithCancel<T>>;
			override prompt<T>(prompt: IPrompt<T>): Promise<IPromptResult<T>>;
			override async prompt<T>(prompt: IPrompt<T>): Promise<IPromptResult<T>> {
				prompts.push(prompt);
				return super.prompt(prompt);
			}
		}();
		const dialog = store.add(new ProjectReadinessDialog(
			{
				getWorkspace: () => ({ id: 'example', folders }),
				getWorkbenchState: () => workbenchState,
				onDidChangeWorkbenchState: Event.None,
				onDidChangeWorkspaceFolders: rootsChanged.event,
			},
			{ isWorkspaceTrusted: () => trusted, onDidChangeTrust: trustChanged.event, workspaceTrustInitialized: Promise.resolve() },
			configuration, files, dialogs,
		));
		return {
			dialog, registration, prompts, inspected, settings, activations, lookups, operations, stats,
			changeRoots(next: WorkspaceFolder[], fire = true) {
				const previous = folders;
				folders = next;
				if (fire) {
					rootsChanged.fire({ added: next, removed: previous, changed: [] });
				}
			},
			changeTrust(value: boolean, fire = true) {
				trusted = value;
				if (fire) {
					trustChanged.fire(value);
				}
			},
			changeState(value: WorkbenchState) { workbenchState = value; },
			changeSetting(key = pythonInterpreterKey) {
				configurationChanged.fire({
					source: ConfigurationTarget.WORKSPACE_FOLDER, affectedKeys: new Set([key]), change: { keys: [key], overrides: [] },
					affectsConfiguration: candidate => candidate === key,
				});
			},
			detail() {
				const detail = prompts.at(-1)?.detail;
				assert.ok(typeof detail === 'string');
				return detail;
			},
		};
	}

	test('registers the menu action without collecting until invoked and ignores external command arguments', async () => {
		const state = fixture();
		const registration = store.add(registerProjectReadinessAction(state.dialog));
		const instantiation = store.add(new InstantiationService());
		const command = 'myself.project.checkReadiness';
		const context: IContext = { getValue: <T>(key: string) => (key === 'view' ? 'workbench.explorer.fileView' : false) as T };
		for (const menu of [MenuId.MenubarTerminalMenu, MenuId.ViewTitle]) {
			const items = MenuRegistry.getMenuItems(menu).filter(isIMenuItem).filter(item => item.command.id === command);
			assert.deepStrictEqual(items.map(item => ({ visible: !item.when || item.when.evaluate(context), enabled: !item.command.precondition || item.command.precondition.evaluate(context) })), [{ visible: true, enabled: true }]);
		}
		assert.deepStrictEqual({ inspected: state.inspected, stats: state.stats }, { inspected: [], stats: [] });
		const action = CommandsRegistry.getCommand(command);
		assert.ok(action);
		await instantiation.invokeFunction(action.handler, URI.parse('custom:/ignored'), 'ignored');
		assert.deepStrictEqual(state.inspected, [first.uri.toString()]);
		registration.dispose();
		assert.strictEqual(CommandsRegistry.getCommand(command), undefined);
	});

	test('shows separate results using only six metadata queries per eligible local root', async () => {
		const state = fixture(async resource => {
			const marker = basename(resource);
			if (resource.toString() === joinPath(first.uri, 'pyproject.toml').toString()) {
				return FileType.File;
			}
			if (resource.toString() === joinPath(second.uri, 'Makefile').toString()) {
				return FileType.File;
			}
			if (marker === 'requirements.txt') {
				throw createFileSystemProviderError('private detail', FileSystemProviderErrorCode.FileNotFound);
			}
			if (marker === 'compile_commands.json') {
				throw createFileSystemProviderError('private detail', FileSystemProviderErrorCode.NoPermissions);
			}
			if (marker === '.venv') {
				return resource.toString() === joinPath(first.uri, '.venv').toString() ? FileType.Directory | FileType.SymbolicLink : FileType.SymbolicLink;
			}
			if (marker === 'CMakeLists.txt') {
				return FileType.Directory;
			}
			return FileType.Unknown;
		}, [first, second]);
		const relativePath = '${workspaceFolder}/.venv';
		state.settings.set(first.uri, { value: relativePath, workspaceFolderValue: relativePath });
		state.settings.set(second.uri, { value: 'private-interpreter', userValue: 'private-interpreter' });
		await state.dialog.run();
		assert.deepStrictEqual(state.stats, [first, second].flatMap(({ uri }) => markerNames.map(marker => joinPath(uri, marker).toString())));
		assert.deepStrictEqual({ inspect: state.inspected, activate: state.activations, fileOperations: state.operations }, {
			inspect: [first.uri.toString(), second.uri.toString()], activate: [], fileOperations: [],
		});
		const detail = state.detail();
		const [summary, python, c] = detail.split('\n\n');
		assert.match(summary, /availability are unverified/);
		assert.match(python, /pyproject\.toml — Found/);
		assert.match(python, /requirements\.txt — Missing/);
		assert.match(python, /compile_commands\.json — Not checked/);
		assert.match(python, /\.venv — Symbolic link, target unverified/);
		assert.match(python, /Folder-relative path \(Folder Settings\)/);
		assert.match(c, /Makefile — Found/);
		assert.match(c, /CMakeLists\.txt — Unexpected type/);
		assert.match(c, /\.venv — Symbolic link, target unverified/);
		assert.match(c, /Configured, path unresolved \(User Settings\)/);
		assert.doesNotMatch(detail, /private detail|private-interpreter|\$\{workspaceFolder\}/);
		assert.deepStrictEqual({ custom: state.prompts[0].custom, buttons: state.prompts[0].buttons }, { custom: true, buttons: undefined });
	});

	test('shows Restricted Mode guidance without querying providers or reading interpreter settings', async () => {
		const state = fixture(async () => assert.fail('Unexpected metadata request'), [first, second]);
		state.changeTrust(false);
		state.settings.set(first.uri, { value: 'private setting', workspaceFolderValue: 'private setting' });
		await state.dialog.run();
		assert.match(state.detail(), /Restricted Mode is active\. Folder metadata and interpreter settings were skipped/);
		assert.strictEqual(state.detail().match(/ — Not checked/g)?.length, 14);
		assert.deepStrictEqual({ inspect: state.inspected, lookup: state.lookups, stats: state.stats, activation: state.activations }, {
			inspect: [], lookup: [], stats: [], activation: [],
		});
	});

	test('rejects unsupported URI forms before provider lookup or configuration inspection', async () => {
		const roots = [
			URI.parse('vscode-remote://ssh-remote+test/workspace'),
			URI.parse('custom:/workspace'),
			URI.parse('file://files.example/workspace'),
			first.uri.with({ query: 'private-query' }),
			first.uri.with({ fragment: 'private-fragment' }),
			first.uri.with({ path: first.uri.path + '/../other' }),
		].map((uri, index) => new WorkspaceFolder({ uri, name: 'Unsupported', index }));
		const state = fixture(async () => assert.fail('Unexpected metadata request'), roots);
		await state.dialog.run();
		assert.deepStrictEqual({ lookups: state.lookups, inspected: state.inspected, activation: state.activations }, { lookups: [], inspected: [], activation: [] });
		assert.strictEqual(state.detail().match(/outside the supported local file scope/g)?.length, roots.length);
		assert.doesNotMatch(state.detail(), /private-query|private-fragment|ssh-remote/);
	});

	test('leaves markers unchecked without an already registered provider', async () => {
		const state = fixture(async () => assert.fail('Unexpected metadata request'), [first], false);
		await state.dialog.run();
		assert.strictEqual(state.detail().match(/ — Not checked/g)?.length, 6);
		assert.deepStrictEqual({ activations: state.activations, operations: state.operations, lookups: state.lookups, stats: state.stats }, {
			activations: [], operations: [], lookups: [Schemas.file], stats: [],
		});
	});

	test('classifies explicit paths only in the verified scope and never expands variables', async () => {
		const state = fixture(undefined, [first, second], false);
		const absolute = isWindows ? 'C:\\tools\\python.exe' : '/tools/python';
		state.settings.set(first.uri, { value: absolute, userValue: absolute });
		state.settings.set(second.uri, { value: '.venv', workspaceValue: '.venv', userValue: absolute });
		await state.dialog.run();
		assert.match(state.detail(), /Absolute path \(User Settings\)/);
		assert.match(state.detail(), /Configured, path unresolved \(Workspace Settings\)/);

		state.changeRoots([second]);
		state.changeState(WorkbenchState.FOLDER);
		await state.dialog.run();
		assert.match(state.detail(), /Folder-relative path \(Workspace Settings\)/);

		for (const value of ['${command:example}/python', '${env:HOME}/python', '${workspaceFolder:Other}/python', '../private/python', 'python', '']) {
			state.settings.set(second.uri, { value, workspaceFolderValue: value });
			await state.dialog.run();
			assert.match(state.detail(), /Configured, path unresolved \(Folder Settings\)/);
		}
		state.settings.set(second.uri, { value: 'python', defaultValue: 'python' });
		await state.dialog.run();
		assert.match(state.detail(), /No explicit setting/);

		state.settings.set(second.uri, { value: absolute, workspaceFolderValue: '.venv' });
		await state.dialog.run();
		assert.match(state.detail(), /Configured, path unresolved \(Unknown Source\)/);
		state.settings.set(second.uri, { value: absolute, defaultValue: 'python' });
		await state.dialog.run();
		assert.match(state.detail(), /Configured, path unresolved \(Unknown Source\)/);
		assert.deepStrictEqual(state.stats, []);
	});

	test('keeps marker results and other roots when configuration inspection fails', async () => {
		const state = fixture(async () => FileType.File, [first, second]);
		state.settings.set(first.uri, new Error('private configuration error'));
		state.settings.set(second.uri, { value: '.venv', workspaceFolderValue: '.venv' });
		await state.dialog.run();
		const detail = state.detail();
		const [, unchecked, checked] = detail.split('\n\n');
		assert.match(unchecked, /Python Interpreter Setting — Not checked/);
		assert.match(unchecked, /requirements\.txt — Found/);
		assert.match(checked, /Folder-relative path \(Folder Settings\)/);
		assert.doesNotMatch(detail, /private configuration error/);
	});

	test('bounds metadata concurrency across roots and coalesces repeated clicks', async () => {
		const started = new DeferredPromise<void>();
		const release = new DeferredPromise<void>();
		let running = 0;
		let peak = 0;
		let count = 0;
		const state = fixture(async () => {
			count++;
			peak = Math.max(++running, peak);
			if (count === 4) {
				await started.complete();
			}
			await release.p;
			running--;
			return FileType.File;
		}, [first, second]);
		const pending = state.dialog.run();
		await started.p;
		await state.dialog.run();
		assert.strictEqual(count, 4);
		await release.complete();
		await pending;
		assert.deepStrictEqual({ count, peak, prompts: state.prompts.length }, { count: 12, peak: 4, prompts: 1 });
	});

	const invalidations = {
		roots: (state: ReturnType<typeof fixture>) => state.changeRoots([second]),
		trust: (state: ReturnType<typeof fixture>) => { state.changeTrust(false); state.changeTrust(true); },
		'silent trust revocation': (state: ReturnType<typeof fixture>) => state.changeTrust(false, false),
		configuration: (state: ReturnType<typeof fixture>) => state.changeSetting(),
		provider: (state: ReturnType<typeof fixture>) => state.registration?.dispose(),
		disposal: (state: ReturnType<typeof fixture>) => state.dialog.dispose(),
		'silent root replacement': (state: ReturnType<typeof fixture>) => state.changeRoots([second], false),
	};
	for (const [change, invalidate] of Object.entries(invalidations)) {
		test(`discards a delayed result after ${change}`, async () => {
			const started = new DeferredPromise<void>();
			const release = new DeferredPromise<void>();
			let count = 0;
			const state = fixture(async () => {
				if (++count === 4) {
					await started.complete();
				}
				await release.p;
				return FileType.File;
			});
			const pending = state.dialog.run();
			await started.p;
			invalidate(state);
			await release.complete();
			await pending;
			assert.deepStrictEqual({ prompts: state.prompts, count }, { prompts: [], count: change === 'silent root replacement' ? 6 : 4 });
		});
	}

	test('shows the empty-window guidance without requesting metadata or settings', async () => {
		const state = fixture(async () => assert.fail('Unexpected metadata request'), []);
		await state.dialog.run();
		assert.match(state.detail(), /Open a folder/);
		assert.deepStrictEqual({ lookups: state.lookups, inspected: state.inspected }, { lookups: [], inspected: [] });
	});
});
