/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, type IConfigurationOverrides, type IConfigurationUpdateOptions, type IConfigurationUpdateOverrides, type IConfigurationValue } from '../../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope, Extensions, type IConfigurationNode, type IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import type { IConfirmation, IOpenDialogOptions } from '../../../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { createFileSystemProviderError, FileSystemProviderErrorCode, FileType, type IStat } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { WorkbenchState, WorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { ClangdExecutablePicker, registerClangdExecutablePickerAction } from '../../browser/clangdExecutablePicker.js';

suite('Project clangd executable picker', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	const clientId = 'llvm-vs-code-extensions.vscode-clangd';
	const pathKey = 'clangd.path';
	const updatesKey = 'clangd.checkUpdates';
	const scriptKey = 'clangd.useScriptAsExecutable';
	const local = (value: string) => URI.file(isWindows ? `C:${value}` : value);
	const folder = new WorkspaceFolder({ uri: local('/workspace/C sample'), name: 'C sample', index: 0 });
	const candidate = local('/local tools/ñ #clangd');
	const destination = joinPath(folder.uri, '.vscode', 'settings.json');
	const definition: IConfigurationNode = {
		id: 'clangd',
		extensionInfo: { id: clientId },
		properties: {
			[pathKey]: { scope: ConfigurationScope.MACHINE_OVERRIDABLE, type: 'string', default: 'clangd' },
			[updatesKey]: { scope: ConfigurationScope.WINDOW, type: 'boolean', default: false },
			[scriptKey]: { scope: ConfigurationScope.MACHINE_OVERRIDABLE, type: 'boolean', default: false },
		},
	};
	setup(() => {
		registry.registerConfiguration(definition);
		store.add({ dispose: () => registry.deregisterConfigurations([definition]) });
	});

	function fixture({ isRemote = false, state = WorkbenchState.FOLDER, folders = [folder], version = '0.6.0', defaultKeys = [pathKey, updatesKey, scriptKey] } = {}) {
		const workspace = { id: 'fixture-workspace', folders };
		const trustChanges = store.add(new Emitter<boolean>());
		const client = { identifier: new ExtensionIdentifier(clientId), version, extensionLocation: local('/extensions/clangd') };
		const settings = new Map<string, IConfigurationValue<unknown>>([
			[pathKey, { value: '/old/clangd', workspaceValue: '/old/clangd', defaultValue: 'clangd' }],
			[updatesKey, { value: false }],
			[scriptKey, { value: false }],
		]);
		const probed: URI[] = [];
		const opened: IOpenDialogOptions[] = [];
		const confirmations: IConfirmation[] = [];
		const writes: { key: string; value: unknown; overrides?: IConfigurationUpdateOverrides | IConfigurationOverrides | ConfigurationTarget; target?: ConfigurationTarget; options?: IConfigurationUpdateOptions }[] = [];
		const notices: string[] = [];
		let trusted = true;
		let selected = [candidate];
		let updateWindowValue = true;
		let confirm = async () => true;
		const stat = async (uri: URI): Promise<IStat> => {
			if (uri.toString() === destination.toString()) {
				throw createFileSystemProviderError('missing', FileSystemProviderErrorCode.FileNotFound);
			}
			return { type: uri.toString() === candidate.toString() ? FileType.File : FileType.Directory, size: 10, ctime: 1, mtime: 2 };
		};
		let effectiveStat = stat;
		const provider = store.add(new class extends InMemoryFileSystemProvider {
			override stat(uri: URI): Promise<IStat> {
				probed.push(uri);
				return effectiveStat(uri);
			}
		}());
		const picker = store.add(new ClangdExecutablePicker({
			context: {
				getWorkspace: () => workspace,
				getWorkbenchState: () => state,
				getWorkspaceFolder: resource => folders.find(value => value.uri.toString() === resource.toString()) ?? null,
				onDidChangeWorkbenchState: Event.None,
				onDidChangeWorkspaceFolders: Event.None,
			},
			trust: {
				workspaceTrustInitialized: Promise.resolve(),
				isWorkspaceTrusted: () => trusted,
				onDidChangeTrust: trustChanges.event,
			},
			configuration: {
				inspect<T>(key: string, overrides?: IConfigurationOverrides): IConfigurationValue<Readonly<T>> {
					assert.strictEqual(overrides, undefined, 'match unscoped reads by the clangd client');
					assert.ok(settings.has(key));
					return settings.get(key) as IConfigurationValue<Readonly<T>>;
				},
				keys: () => ({ default: defaultKeys, policy: [], user: [], workspace: [], workspaceFolder: [] }),
				onDidChangeConfiguration: Event.None,
				async updateValue(key: string, value: unknown, overrides?: IConfigurationUpdateOverrides | IConfigurationOverrides | ConfigurationTarget, target?: ConfigurationTarget, options?: IConfigurationUpdateOptions) {
					writes.push({ key, value, overrides, target, options });
					if (updateWindowValue) {
						settings.set(key, { workspaceValue: value, value });
					}
				},
			},
			registeredExtensions: () => [client],
			fileDialog: { async showOpenDialog(options) { opened.push(options); return selected; } },
			files: { getProvider: scheme => { assert.strictEqual(scheme, Schemas.file); return provider; } },
			dialogs: { async confirm(options) { confirmations.push(options); return { confirmed: await confirm() }; } },
			notification: { info: message => notices.push(String(message)), warn: message => notices.push(String(message)), error: message => notices.push(String(message)) },
			isRemote,
		}));
		return {
			picker, workspace, client, settings, probed, opened, confirmations, writes, notices,
			select(uri: URI) { selected = [uri]; },
			onConfirm(handler: () => Promise<boolean>) { confirm = handler; },
			changeStat(change: (uri: URI, original: () => Promise<IStat>) => Promise<IStat>) { effectiveStat = uri => change(uri, () => stat(uri)); },
			setTrust(value: boolean) { trusted = value; trustChanges.fire(value); },
			dropEffectiveUpdate() { updateWindowValue = false; },
		};
	}

	test('previews the exact path and consequences, then changes only the selected folder key', async () => {
		const data = fixture();
		data.onConfirm(async () => {
			assert.strictEqual(data.writes.length, 0, 'no write before confirmation');
			assert.deepStrictEqual(data.probed, [candidate]);
			return true;
		});
		await data.picker.run();
		assert.deepStrictEqual(data.opened[0].availableFileSystems, [Schemas.file]);
		assert.strictEqual(data.opened[0].canSelectMany, false);
		assert.strictEqual(data.confirmations.length, 1);
		const detail = data.confirmations[0].detail;
		assert.ok(typeof detail === 'string');
		assert.ok(detail.includes(JSON.stringify(candidate.fsPath)));
		assert.ok(detail.includes('/old/clangd'));
		assert.ok(detail.includes('execute') && detail.includes('GitHub') && detail.includes('recovery'));
		assert.deepStrictEqual(data.writes, [{
			key: pathKey, value: candidate.fsPath, overrides: { resource: folder.uri },
			target: ConfigurationTarget.WORKSPACE_FOLDER, options: { donotNotifyError: true },
		}]);
		assert.deepStrictEqual(data.probed.map(uri => uri.toString()),
			[candidate, folder.uri, joinPath(folder.uri, '.vscode'), destination, candidate].map(uri => uri.toString()));
		assert.strictEqual(data.settings.get(pathKey)?.value, candidate.fsPath);
		assert.ok(data.notices.some(text => text.includes('Saved clangd.path')));
	});

	test('rejects remote, Restricted and workspace-file windows before opening the picker', async () => {
		const second = new WorkspaceFolder({ uri: local('/workspace/another'), name: 'C sample', index: 1 });
		const restricted = fixture();
		restricted.setTrust(false);
		for (const data of [restricted, fixture({ isRemote: true }), fixture({ state: WorkbenchState.WORKSPACE }), fixture({ folders: [folder, second] })]) {
			await data.picker.run();
			assert.deepStrictEqual([data.opened.length, data.probed.length, data.writes.length], [0, 0, 0]);
		}
	});

	test('requires the reviewed installed client and three registered setting definitions', async () => {
		const remoteClient = fixture();
		remoteClient.client.extensionLocation = URI.parse('vscode-remote://host/clangd');
		for (const data of [fixture({ version: '0.6.1' }), fixture({ defaultKeys: [pathKey, scriptKey] }), remoteClient]) {
			await data.picker.run();
			assert.deepStrictEqual([data.opened.length, data.probed.length, data.writes.length], [0, 0, 0]);
		}
		registry.deregisterConfigurations([definition]);
		const wrongOwner = { ...definition, extensionInfo: { id: 'example.other' } };
		registry.registerConfiguration(wrongOwner);
		store.add({ dispose: () => registry.deregisterConfigurations([wrongOwner]) });
		const data = fixture();
		await data.picker.run();
		assert.strictEqual(data.opened.length, 0);
	});

	test('blocks unsafe effective flags and overriding path values', async () => {
		const changes: [string, IConfigurationValue<unknown>][] = [
			[updatesKey, { value: true }],
			[scriptKey, { value: true }],
			[updatesKey, { value: undefined }],
			[scriptKey, { value: 'false' }],
			[pathKey, { value: '/pinned', policyValue: '/pinned' }],
			[pathKey, { value: '/pinned', memoryValue: '/pinned' }],
		];
		for (const [key, setting] of changes) {
			const data = fixture();
			data.settings.set(key, setting);
			await data.picker.run();
			assert.deepStrictEqual([data.opened.length, data.writes.length], [0, 0]);
		}
	});

	test('declines UNC, substitutions and symbolic links before asking for consent', async () => {
		for (const uri of [URI.parse('file://remote/share/clangd'), local('/tools/${env:COMMAND}/clangd'), URI.parse('other:/clangd')]) {
			const data = fixture();
			data.select(uri);
			await data.picker.run();
			assert.deepStrictEqual([data.probed.length, data.confirmations.length, data.writes.length], [0, 0, 0]);
		}
		const linked = fixture();
		linked.changeStat(async (_uri, original) => ({ ...await original(), type: FileType.File | FileType.SymbolicLink }));
		await linked.picker.run();
		assert.deepStrictEqual([linked.confirmations.length, linked.writes.length], [0, 0]);
	});

	test('cancel and changes to trust, folder identity, client, flags or path prevent dispatch', async () => {
		for (const change of [
			(data: ReturnType<typeof fixture>) => data.setTrust(false),
			(data: ReturnType<typeof fixture>) => { data.workspace.id = 'new-id'; },
			(data: ReturnType<typeof fixture>) => { data.client.version = '0.6.1'; },
			(data: ReturnType<typeof fixture>) => data.settings.set(updatesKey, { value: true }),
			(data: ReturnType<typeof fixture>) => data.settings.set(pathKey, { value: '/new/clangd', workspaceValue: '/new/clangd' }),
		]) {
			const data = fixture();
			data.onConfirm(async () => { change(data); return true; });
			await data.picker.run();
			assert.strictEqual(data.confirmations.length, 1);
			assert.strictEqual(data.writes.length, 0);
		}
		const cancelled = fixture();
		cancelled.onConfirm(async () => false);
		await cancelled.picker.run();
		assert.deepStrictEqual(cancelled.probed, [candidate]);
		assert.strictEqual(cancelled.writes.length, 0);
	});

	test('rechecks the candidate and refuses a symlink destination', async () => {
		const changed = fixture();
		changed.onConfirm(async () => {
			changed.changeStat(async (uri, original) => uri === candidate ? { ...await original(), mtime: 3 } : original());
			return true;
		});
		const linked = fixture();
		linked.changeStat(async (uri, original) => uri.toString() === destination.toString()
			? { type: FileType.File | FileType.SymbolicLink, ctime: 1, mtime: 2, size: 10 } : original());
		for (const data of [changed, linked]) {
			await data.picker.run();
			assert.strictEqual(data.confirmations.length, 1);
			assert.strictEqual(data.writes.length, 0);
		}
	});

	test('warns if the window still sees a different path and makes no second write', async () => {
		const data = fixture();
		data.dropEffectiveUpdate();
		await data.picker.run();
		assert.strictEqual(data.writes.length, 1);
		assert.ok(data.notices.some(text => text.includes('effective clangd path in this window differs')));
	});

	test('registers the action in Terminal and Files and ignores arguments from a caller', async () => {
		const id = 'myself.project.configureClangdExecutable';
		const calls: unknown[][] = [];
		store.add(registerClangdExecutablePickerAction({ async run(...args) { calls.push(args); } }));
		for (const menu of [MenuId.MenubarTerminalMenu, MenuId.ViewTitle]) {
			assert.ok(MenuRegistry.getMenuItems(menu).some(item => isIMenuItem(item) && item.command.id === id));
		}
		const command = CommandsRegistry.getCommand(id);
		assert.ok(command);
		const instantiation = store.add(new InstantiationService());
		await instantiation.invokeFunction(command.handler, '/do-not-use');
		assert.deepStrictEqual(calls, [[]]);
	});
});
