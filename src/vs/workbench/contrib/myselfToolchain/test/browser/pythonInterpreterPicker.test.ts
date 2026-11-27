/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, type IConfigurationChangeEvent, type IConfigurationOverrides, type IConfigurationUpdateOptions, type IConfigurationUpdateOverrides, type IConfigurationValue } from '../../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope, Extensions, type IConfigurationNode, type IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import type { IConfirmation, IOpenDialogOptions } from '../../../../../platform/dialogs/common/dialogs.js';
import { FileSystemProviderErrorCode, FileType, createFileSystemProviderError, type IStat } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import type { IPickOptions, IQuickPickItem, QuickPickInput } from '../../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { WorkbenchState, WorkspaceFolder, type IWorkspaceFoldersChangeEvent } from '../../../../../platform/workspace/common/workspace.js';
import { registerPythonInterpreterPickerAction } from '../../browser/myselfToolchain.contribution.js';
import { PythonInterpreterPicker } from '../../browser/pythonInterpreterPicker.js';
import { basedPyrightInterpreterSetting, pythonInterpreterSetting } from '../../browser/pythonInterpreterSetting.js';

suite('Project Python interpreter picker', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	const definition: IConfigurationNode = {
		id: 'python',
		extensionInfo: { id: 'ms-python.python' },
		properties: { [pythonInterpreterSetting]: { scope: ConfigurationScope.MACHINE_OVERRIDABLE, type: 'string', default: 'python' } },
	};
	const path = (value: string) => URI.file(isWindows ? `C:${value}` : value);
	const first = new WorkspaceFolder({ uri: path('/workspace/first'), name: 'Same name', index: 0 });
	const second = new WorkspaceFolder({ uri: path('/workspace/second'), name: 'Same name', index: 1 });
	const interpreter = path('/local tools/ñ 100%#Python');

	setup(() => {
		registry.registerConfiguration(definition);
		store.add({ dispose: () => registry.deregisterConfigurations([definition]) });
	});

	function registerBasedPyright(owner = 'detachhead.basedpyright', scope = ConfigurationScope.RESOURCE, type: 'string' | 'boolean' = 'string') {
		const contribution: IConfigurationNode = {
			id: 'basedpyright',
			extensionInfo: { id: owner },
			properties: { [basedPyrightInterpreterSetting]: { scope, type, default: type === 'string' ? 'python' : false } },
		};
		registry.registerConfiguration(contribution);
		return store.add({ dispose: () => registry.deregisterConfigurations([contribution]) });
	}

	function fixture({ initialFolders = [first], state = WorkbenchState.FOLDER, isRemote = false, defaultKeys = [pythonInterpreterSetting] as string[], initialized = Promise.resolve() } = {}) {
		let folders = initialFolders;
		let trusted = true;
		const foldersChanged = store.add(new Emitter<IWorkspaceFoldersChangeEvent>());
		const trustChanged = store.add(new Emitter<boolean>());
		const configurationChanged = store.add(new Emitter<IConfigurationChangeEvent>());
		const opened: IOpenDialogOptions[] = [];
		const previews: IConfirmation[] = [];
		const inspected: URI[] = [];
		const probed: URI[] = [];
		const writes: { key: string; value: unknown; overrides?: IConfigurationOverrides | IConfigurationUpdateOverrides | ConfigurationTarget; target?: ConfigurationTarget; options?: IConfigurationUpdateOptions }[] = [];
		const notifications: string[] = [];
		const folderChoices: IQuickPickItem[][] = [];
		const settingChoices: IQuickPickItem[][] = [];
		let choice: number | undefined = 1;
		let settingChoice: number | undefined;
		let fileResult = async (): Promise<URI[] | undefined> => [interpreter];
		let confirmResult = async (): Promise<boolean> => true;
		const settings = new Map<string, IConfigurationValue<unknown>>();
		let writeResult = async (): Promise<void> => { };
		let statResult = async (resource: URI): Promise<FileType> => {
			if (resource.path.endsWith('/settings.json')) {
				throw createFileSystemProviderError('missing', FileSystemProviderErrorCode.FileNotFound);
			}
			return FileType.Directory;
		};
		const provider = store.add(new class extends InMemoryFileSystemProvider {
			override async stat(resource: URI): Promise<IStat> {
				probed.push(resource);
				return { type: await statResult(resource), ctime: 0, mtime: 0, size: 0 };
			}
		}());
		const quickInput = new class {
			pick<T extends IQuickPickItem>(items: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options: IPickOptions<T> & { canPickMany: true }): Promise<T[] | undefined>;
			pick<T extends IQuickPickItem>(items: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: IPickOptions<T>): Promise<T | undefined>;
			async pick<T extends IQuickPickItem>(items: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[]): Promise<T | undefined> {
				const picks = (await items).filter((item): item is T => item.type !== 'separator');
				if (picks[0] && Object.hasOwn(picks[0], 'candidate')) {
					settingChoices.push(picks);
					return settingChoice === undefined ? undefined : picks[settingChoice];
				}
				folderChoices.push(picks);
				return choice === undefined ? undefined : picks[choice];
			}
		}();
		const picker = store.add(new PythonInterpreterPicker({
			context: {
				getWorkspace: () => ({ id: 'fixture-workspace', folders }),
				getWorkbenchState: () => state,
				getWorkspaceFolder: resource => folders.find(folder => folder.uri.toString() === resource.toString()) ?? null,
				onDidChangeWorkspaceFolders: foldersChanged.event,
				onDidChangeWorkbenchState: Event.None,
			},
			trust: { isWorkspaceTrusted: () => trusted, onDidChangeTrust: trustChanged.event, workspaceTrustInitialized: initialized },
			configuration: {
				inspect<T>(key: string, overrides?: IConfigurationOverrides): IConfigurationValue<Readonly<T>> {
					assert.ok(defaultKeys.includes(key));
					assert.ok(overrides?.resource);
					inspected.push(overrides.resource);
					return (settings.get(key) ?? { value: 'python', defaultValue: 'python' }) as IConfigurationValue<Readonly<T>>;
				},
				keys: () => ({ default: defaultKeys, policy: [], user: [], workspace: [], workspaceFolder: [] }),
				onDidChangeConfiguration: configurationChanged.event,
				async updateValue(key: string, value: unknown, overrides?: IConfigurationOverrides | IConfigurationUpdateOverrides | ConfigurationTarget, target?: ConfigurationTarget, options?: IConfigurationUpdateOptions) {
					writes.push({ key, value, overrides, target, options });
					await writeResult();
				},
			},
			quickInput,
			fileDialog: {
				showOpenDialog(options) {
					opened.push(options);
					return fileResult();
				},
			},
			files: { getProvider: scheme => { assert.strictEqual(scheme, Schemas.file); return provider; } },
			dialogs: { async confirm(preview) { previews.push(preview); return { confirmed: await confirmResult() }; } },
			notification: {
				info: message => notifications.push(String(message)),
				warn: message => notifications.push(String(message)),
				error: message => notifications.push(String(message)),
			},
			isRemote,
		}));
		return {
			picker, writes, probed, previews, inspected, opened, notifications, folderChoices, settingChoices,
			selectFolder(index: number | undefined) { choice = index; },
			selectSetting(index: number | undefined) { settingChoice = index; },
			fileResult(result: () => Promise<URI[] | undefined>) { fileResult = result; },
			confirmResult(result: () => Promise<boolean>) { confirmResult = result; },
			statResult(result: (resource: URI) => Promise<FileType>) { statResult = result; },
			writeResult(result: () => Promise<void>) { writeResult = result; },
			setTrust(value: boolean, fire = true) { trusted = value; if (fire) { trustChanged.fire(value); } },
			setFolders(value: WorkspaceFolder[], fire = true) {
				const removed = folders;
				folders = value;
				if (fire) {
					foldersChanged.fire({ added: value, removed, changed: [] });
				}
			},
			setSetting(value: IConfigurationValue<unknown>, fire = false, key: string = pythonInterpreterSetting) {
				settings.set(key, value);
				if (fire) {
					configurationChanged.fire({
						source: ConfigurationTarget.WORKSPACE_FOLDER, affectedKeys: new Set([key]),
						change: { keys: [key], overrides: [] },
						affectsConfiguration: candidate => candidate === key,
					});
				}
			},
		};
	}

	test('requires explicit folder choice and previews a single folder write before dispatch', async () => {
		const view = fixture({ initialFolders: [first, second], state: WorkbenchState.WORKSPACE });
		const oldPath = path('/tools/previous').fsPath;
		view.setSetting({ value: oldPath, userValue: oldPath });
		view.confirmResult(async () => {
			assert.deepStrictEqual({ writes: view.writes, probes: view.probed }, { writes: [], probes: [] });
			return true;
		});
		await view.picker.run();

		assert.deepStrictEqual(view.folderChoices[0].map(item => item.description), [first.uri.fsPath, second.uri.fsPath]);
		assert.deepStrictEqual(view.opened.map(({ defaultUri, availableFileSystems, canSelectFiles, canSelectFolders, canSelectMany }) => ({ defaultUri, availableFileSystems, canSelectFiles, canSelectFolders, canSelectMany })), [
			{ defaultUri: second.uri, availableFileSystems: [Schemas.file], canSelectFiles: true, canSelectFolders: false, canSelectMany: false },
		]);
		const detail = view.previews[0].detail;
		assert.ok(typeof detail === 'string');
		assert.ok(detail.includes(JSON.stringify(oldPath)));
		assert.ok(detail.includes(JSON.stringify(interpreter.fsPath)));
		assert.match(detail, /Current Value \(User Settings\)/);
		assert.match(detail, /Destination — Folder Settings \(\.vscode\/settings\.json\)/);
		assert.match(detail, /keeps any interpreter it has already selected/);
		assert.deepStrictEqual(view.inspected, [second.uri, second.uri]);
		assert.deepStrictEqual(view.writes, [{
			key: pythonInterpreterSetting, value: interpreter.fsPath, overrides: { resource: second.uri },
			target: ConfigurationTarget.WORKSPACE_FOLDER, options: { donotNotifyError: true },
		}]);
		assert.deepStrictEqual(view.probed.map(uri => uri.toString()), [second.uri, joinPath(second.uri, '.vscode'), joinPath(second.uri, '.vscode/settings.json')].map(uri => uri.toString()));
	});

	test('uses the single folder setting in the preview, including when exposed as workspaceValue', async () => {
		const view = fixture();
		view.setSetting({ value: 'old-python', workspaceValue: 'old-python' });
		await view.picker.run();
		const detail = view.previews[0].detail;
		assert.ok(typeof detail === 'string');
		assert.match(detail, /Current Value \(Folder Settings\)/);
		assert.match(detail, /"old-python" → /);
		assert.strictEqual(view.writes[0].target, ConfigurationTarget.WORKSPACE_FOLDER);
		assert.deepStrictEqual(view.folderChoices, []);
	});

	test('takes no folder fallback after canceling multi-root choice, including one eligible local root', async () => {
		const remote = new WorkspaceFolder({ uri: URI.parse('vscode-remote://ssh-remote+test/workspace'), name: 'Remote', index: 1 });
		const view = fixture({ initialFolders: [first, remote], state: WorkbenchState.WORKSPACE });
		view.selectFolder(undefined);
		await view.picker.run();
		assert.deepStrictEqual({ choices: view.folderChoices[0].length, opened: view.opened, writes: view.writes }, { choices: 1, opened: [], writes: [] });
	});

	test('returns without an edit after each picker or preview cancellation', async () => {
		const canceledFile = fixture();
		canceledFile.fileResult(async () => undefined);
		const canceledPreview = fixture();
		canceledPreview.confirmResult(async () => false);
		for (const view of [canceledFile, canceledPreview]) {
			await view.picker.run();
			assert.deepStrictEqual({ probes: view.probed, writes: view.writes }, { probes: [], writes: [] });
		}
	});

	test('checks Workspace Trust and registration before opening any picker', async () => {
		const notTrusted = fixture();
		notTrusted.setTrust(false);
		const remote = fixture({ isRemote: true });
		const missing = fixture({ defaultKeys: [] });
		for (const view of [notTrusted, remote, missing]) {
			await view.picker.run();
			assert.deepStrictEqual({ opened: view.opened, inspected: view.inspected, writes: view.writes }, { opened: [], inspected: [], writes: [] });
		}
		assert.match(notTrusted.notifications[0], /Trust this workspace/);
		assert.match(missing.notifications[0], /BasedPyright or Microsoft Python/);
	});

	test('ignores caller-supplied arguments and exposes the action alongside Check Project', async () => {
		const view = fixture();
		store.add(registerPythonInterpreterPickerAction(view.picker));
		const commandId = 'myself.project.setDefaultPythonInterpreter';
		for (const menu of [MenuId.MenubarTerminalMenu, MenuId.ViewTitle]) {
			assert.ok(MenuRegistry.getMenuItems(menu).filter(isIMenuItem).some(item => item.command.id === commandId));
		}
		const action = CommandsRegistry.getCommand(commandId);
		assert.ok(action);
		const instantiation = store.add(new InstantiationService());
		await instantiation.invokeFunction(action.handler, URI.parse('custom:/caller-path'), ConfigurationTarget.USER);
		assert.deepStrictEqual(view.writes.map(write => [write.target, write.value]), [[ConfigurationTarget.WORKSPACE_FOLDER, interpreter.fsPath]]);
	});

	test('rejects nonlocal or variable-bearing interpreter results before showing a preview', async () => {
		for (const invalid of [
			URI.parse('custom:/python'), URI.parse('file://files.example/python'), interpreter.with({ query: 'x' }),
			interpreter.with({ fragment: 'x' }), path('/tools/${command:run}'), path('/tools/%ENV%'),
			interpreter.with({ path: interpreter.path + '/../other' }),
		]) {
			const view = fixture();
			view.fileResult(async () => [invalid]);
			await view.picker.run();
			assert.deepStrictEqual({ preview: view.previews, probes: view.probed, writes: view.writes }, { preview: [], probes: [], writes: [] });
		}
	});

	test('discards a late file selection after the workspace root changes', async () => {
		const entered = new DeferredPromise<void>();
		const result = new DeferredPromise<URI[]>();
		const view = fixture();
		view.fileResult(async () => { await entered.complete(); return result.p; });
		const run = view.picker.run();
		await entered.p;
		view.setFolders([second], false);
		await result.complete([interpreter]);
		await run;
		assert.deepStrictEqual({ previews: view.previews, writes: view.writes }, { previews: [], writes: [] });
	});

	test('discards a late confirmation after trust is revoked', async () => {
		const entered = new DeferredPromise<void>();
		const result = new DeferredPromise<boolean>();
		const view = fixture();
		view.confirmResult(async () => { await entered.complete(); return result.p; });
		const run = view.picker.run();
		await entered.p;
		view.setTrust(false, false);
		await result.complete(true);
		await run;
		assert.deepStrictEqual({ probes: view.probed, writes: view.writes }, { probes: [], writes: [] });
	});

	test('stops after a trust transition during asynchronous destination checks', async () => {
		const entered = new DeferredPromise<void>();
		const result = new DeferredPromise<FileType>();
		const view = fixture();
		view.statResult(async () => { await entered.complete(); return result.p; });
		const run = view.picker.run();
		await entered.p;
		view.setTrust(false);
		view.setTrust(true);
		await result.complete(FileType.Directory);
		await run;
		assert.deepStrictEqual({ probes: view.probed, writes: view.writes }, { probes: [first.uri], writes: [] });
	});

	test('aborts an edit if the setting changed after the preview', async () => {
		const notified = fixture();
		notified.confirmResult(async () => {
			notified.setSetting({ value: 'changed', workspaceValue: 'changed' }, true);
			assert.ok(notified.previews[0].token?.isCancellationRequested);
			return true;
		});
		const silent = fixture();
		silent.confirmResult(async () => {
			silent.setSetting({ value: 'changed', workspaceValue: 'changed' });
			return true;
		});
		for (const view of [notified, silent]) {
			await view.picker.run();
			assert.deepStrictEqual(view.writes, []);
		}
	});

	test('refuses policy and session overrides and skips an unchanged folder value', async () => {
		for (const setting of [
			{ value: 'python', policyValue: 'python' },
			{ value: 'python', memoryValue: 'python' },
			{ value: interpreter.fsPath, workspaceValue: interpreter.fsPath },
		]) {
			const view = fixture();
			view.setSetting(setting);
			await view.picker.run();
			assert.deepStrictEqual({ previews: view.previews, writes: view.writes }, { previews: [], writes: [] });
		}
	});

	test('refuses symbolic links and unexpected entry types in the settings path', async () => {
		for (const [relative, type] of [
			['.vscode', FileType.Directory | FileType.SymbolicLink],
			['.vscode/settings.json', FileType.File | FileType.SymbolicLink],
			['.vscode/settings.json', FileType.Directory],
		] as const) {
			const view = fixture();
			view.statResult(async resource => resource.toString() === joinPath(first.uri, relative).toString() ? type : FileType.Directory);
			await view.picker.run();
			assert.deepStrictEqual(view.writes, []);
			assert.match(view.notifications[0], /unexpected file type/);
		}
	});

	test('reports a failed settings write without retrying or leaking the underlying error', async () => {
		const view = fixture();
		view.writeResult(async () => { throw new Error('private backend failure'); });
		await view.picker.run();
		assert.strictEqual(view.writes.length, 1);
		assert.match(view.notifications[0], /Unable to update/);
		assert.doesNotMatch(view.notifications.join(), /private backend failure|Saved/);
	});

	test('uses the registered BasedPyright contract as the sole target and reports applicability', async () => {
		registerBasedPyright('DetachHead.basedpyright');
		const view = fixture({ defaultKeys: [basedPyrightInterpreterSetting], initialFolders: [first, second], state: WorkbenchState.WORKSPACE });
		await view.picker.run();
		const detail = view.previews[0].detail;
		assert.ok(typeof detail === 'string');
		assert.match(detail, /BasedPyright — python\.pythonPath/);
		assert.match(detail, /may run the selected Python to resolve imports/);
		assert.doesNotMatch(detail, /python\.defaultInterpreterPath/);
		assert.match(view.notifications[0], /Saved python\.pythonPath \(BasedPyright\).*can take precedence/);
		assert.deepStrictEqual(view.settingChoices, []);
		assert.deepStrictEqual(view.writes.map(write => [write.key, write.overrides, write.target]), [
			[basedPyrightInterpreterSetting, { resource: second.uri }, ConfigurationTarget.WORKSPACE_FOLDER],
		]);
	});

	test('rejects a BasedPyright key with the wrong registered owner, type, or scope', async () => {
		const variants = [
			['another.extension', ConfigurationScope.RESOURCE, 'string'],
			['detachhead.basedpyright', ConfigurationScope.RESOURCE, 'boolean'],
			['detachhead.basedpyright', ConfigurationScope.MACHINE_OVERRIDABLE, 'string'],
		] as const;
		for (const [owner, scope, type] of variants) {
			const registration = registerBasedPyright(owner, scope, type);
			try {
				const view = fixture({ defaultKeys: [basedPyrightInterpreterSetting] });
				await view.picker.run();
				assert.deepStrictEqual({ inspected: view.inspected, opened: view.opened, writes: view.writes }, { inspected: [], opened: [], writes: [] });
			} finally {
				registration.dispose();
			}
		}
	});

	test('asks which setting to edit when both contracts are available and neither folder key is set', async () => {
		registerBasedPyright();
		const view = fixture({ defaultKeys: [pythonInterpreterSetting, basedPyrightInterpreterSetting] });
		view.selectSetting(1);
		await view.picker.run();
		assert.deepStrictEqual(view.settingChoices[0].map(({ label, description }) => [label, description]), [
			['Microsoft Python', pythonInterpreterSetting], ['BasedPyright', basedPyrightInterpreterSetting],
		]);
		assert.deepStrictEqual(view.writes.map(write => write.key), [basedPyrightInterpreterSetting]);
	});

	test('uses the sole effective folder setting when the other provider is only configured at user scope', async () => {
		registerBasedPyright();
		const view = fixture({ defaultKeys: [pythonInterpreterSetting, basedPyrightInterpreterSetting] });
		view.setSetting({ value: 'global-python', userValue: 'global-python' });
		view.setSetting({ value: 'project-python', workspaceValue: 'project-python' }, false, basedPyrightInterpreterSetting);
		await view.picker.run();
		assert.deepStrictEqual({ choices: view.settingChoices, keys: view.writes.map(write => write.key) }, { choices: [], keys: [basedPyrightInterpreterSetting] });
	});

	test('preserves both configured keys when choice is canceled and only updates the explicitly chosen key', async () => {
		registerBasedPyright();
		const view = fixture({ defaultKeys: [pythonInterpreterSetting, basedPyrightInterpreterSetting] });
		view.setSetting({ value: 'python-one', workspaceValue: 'python-one' });
		view.setSetting({ value: 'python-two', workspaceValue: 'python-two' }, false, basedPyrightInterpreterSetting);
		await view.picker.run();
		assert.deepStrictEqual({ choices: view.settingChoices.length, opened: view.opened, writes: view.writes }, { choices: 1, opened: [], writes: [] });
		view.selectSetting(0);
		await view.picker.run();
		assert.deepStrictEqual(view.writes.map(write => write.key), [pythonInterpreterSetting]);
	});

	test('discards a preview if another contract becomes configured or the chosen schema disappears', async () => {
		const registration = registerBasedPyright();
		const conflict = fixture({ defaultKeys: [pythonInterpreterSetting, basedPyrightInterpreterSetting] });
		conflict.setSetting({ value: 'initial', workspaceValue: 'initial' }, false, basedPyrightInterpreterSetting);
		conflict.confirmResult(async () => {
			conflict.setSetting({ value: 'other', workspaceValue: 'other' });
			return true;
		});
		await conflict.picker.run();
		assert.deepStrictEqual(conflict.writes, []);

		const removed = fixture({ defaultKeys: [pythonInterpreterSetting, basedPyrightInterpreterSetting] });
		removed.selectSetting(1);
		removed.confirmResult(async () => { registration.dispose(); return true; });
		await removed.picker.run();
		assert.deepStrictEqual(removed.writes, []);
	});
});
