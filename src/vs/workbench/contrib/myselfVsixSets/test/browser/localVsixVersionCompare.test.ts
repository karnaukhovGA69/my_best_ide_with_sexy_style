/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Schemas } from '../../../../../base/common/network.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IDialogService, IFileDialogService, type IOpenDialogOptions, type IPrompt } from '../../../../../platform/dialogs/common/dialogs.js';
import type { ILocalExtension } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionType, TargetPlatform } from '../../../../../platform/extensions/common/extensions.js';
import { FileType, IFileService, type IFileSystemProvider, type IFileSystemProviderRegistrationEvent } from '../../../../../platform/files/common/files.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IProgressService, Progress, type IProgress, type IProgressOptions, type IProgressStep } from '../../../../../platform/progress/common/progress.js';
import { toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { UserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfileService.js';
import { ExtensionState, IExtensionsWorkbenchService, VIEWLET_ID, type IExtension } from '../../../extensions/common/extensions.js';
import { InstallationDiagnosticsProfileTracker } from '../../../myselfDiagnostics/browser/installationDiagnosticsReader.js';
import type { LocalVsixInspector } from '../../browser/localVsixSetMetadata.js';
import { registerLocalVsixVersionCompareAction } from '../../browser/localVsixVersionCompare.contribution.js';
import { compareLocalVsixVersion } from '../../browser/localVsixVersionComparison.js';

suite('Compare Local VSIX Version', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const commandId = 'myself.extensions.compareLocalVsixVersion';
	const file = URI.file('/fixtures/selected.vsix');
	const local = URI.file('/fixtures/installed');
	const profileA = toUserDataProfile('profile-a', 'Development', URI.file('/fixtures/a'), URI.file('/fixtures/cache'));
	const profileB = toUserDataProfile('profile-b', 'Other', URI.file('/fixtures/b'), URI.file('/fixtures/cache'));
	const metadata = { id: 'fixture.tool', version: '1.10.0+local', engine: '^1.140.0', sha256: 'ab'.repeat(32), bytes: 32 };

	function installed(version: string, overrides?: Partial<ILocalExtension>, state = ExtensionState.Installed): IExtension {
		return new class extends mock<IExtension>() {
			override readonly state = state;
			override readonly local: ILocalExtension = {
				identifier: { id: 'Fixture.Tool' },
				location: local,
				type: ExtensionType.User,
				manifest: { publisher: 'Fixture', name: 'Tool', version, engines: { vscode: '*' } },
				isBuiltin: false, isValid: true, validations: [], targetPlatform: TargetPlatform.UNIVERSAL,
				isWorkspaceScoped: false, isMachineScoped: false, isApplicationScoped: false, publisherId: null,
				isPreReleaseVersion: false, hasPreReleaseVersion: false, private: false, preRelease: false, updated: false,
				pinned: false, forceAutoUpdate: false, source: 'vsix', size: 0, ...overrides,
			};
		}();
	}

	function fixture(options: { remote?: boolean; installed?: IExtension[]; initialized?: Promise<void> } = {}) {
		const profiles = store.add(new UserDataProfileService(profileA));
		const tracker = store.add(new InstallationDiagnosticsProfileTracker(profiles));
		const registrationChanges = store.add(new Emitter<IFileSystemProviderRegistrationEvent>());
		const events: string[] = [];
		const dialogsShown: (IPrompt<unknown> & { detail: string })[] = [];
		const errors: string[] = [];
		const pickerOptions: IOpenDialogOptions[] = [];
		const inspections: Parameters<LocalVsixInspector>[] = [];
		const inventoryWaiting = new DeferredPromise<void>();
		let inventoryReads = 0;
		let cached = options.installed ?? [installed('1.2.0')];
		let selection: Promise<URI[] | undefined> = Promise.resolve([file]);
		let inspect: LocalVsixInspector = async () => metadata;
		let returnedStat = { type: FileType.File, size: metadata.bytes, mtime: 1, ctime: 1 };
		let postStatEffect: (() => void) | undefined;
		let shouldHaveProvider = true;
		let statCount = 0;
		let cancelProgress: (() => void) | undefined;

		const provider = new class extends mock<IFileSystemProvider>() {
			override async stat(resource: URI) {
				assert.strictEqual(resource, file);
				events.push('stat');
				if (++statCount === 2) {
					postStatEffect?.();
				}
				return { ...returnedStat };
			}
		}();
		const fileDialog = new class extends mock<IFileDialogService>() {
			override showOpenDialog(args: IOpenDialogOptions): Promise<URI[] | undefined> {
				pickerOptions.push(args);
				events.push('picker');
				return selection;
			}
		}();
		const files = new class extends mock<IFileService>() {
			override readonly onDidChangeFileSystemProviderRegistrations = registrationChanges.event;
			override getProvider(scheme: string) {
				assert.strictEqual(scheme, Schemas.file);
				return shouldHaveProvider ? provider : undefined;
			}
		}();
		const dialogs = new class extends mock<IDialogService>() {
			override prompt = (async (prompt: IPrompt<unknown>) => {
				assert.ok(typeof prompt.detail === 'string');
				dialogsShown.push({ ...prompt, detail: prompt.detail });
				return { result: undefined };
			}) as IDialogService['prompt'];
			override async error(message: string, detail?: string): Promise<void> {
				errors.push(message + ' ' + detail);
			}
		}();
		const progress = new class extends mock<IProgressService>() {
			override withProgress<R>(options: IProgressOptions, task: (progress: IProgress<IProgressStep>) => Promise<R>, onDidCancel?: (choice?: number) => void): Promise<R> {
				assert.strictEqual(options.cancellable, true);
				cancelProgress = onDidCancel;
				return task(Progress.None);
			}
		}();
		const inventory = new class extends mock<IExtensionsWorkbenchService>() {
			override get whenInitialized(): Promise<void> {
				events.push('wait-cache');
				void inventoryWaiting.complete();
				return options.initialized ?? Promise.resolve();
			}
			override get installed(): IExtension[] {
				events.push('read-cache');
				inventoryReads++;
				return cached;
			}
		}();
		const environment = new class extends mock<IWorkbenchEnvironmentService>() {
			override readonly remoteAuthority = options.remote ? 'ssh-remote+fixture' : undefined;
		}();

		const instantiation = store.add(new InstantiationService(new ServiceCollection(
			[IUserDataProfileService, profiles], [IFileDialogService, fileDialog], [IFileService, files], [IDialogService, dialogs],
			[IProgressService, progress], [IExtensionsWorkbenchService, inventory], [IWorkbenchEnvironmentService, environment],
		), true));
		const registration = store.add(registerLocalVsixVersionCompareAction(() => (...args) => {
			events.push('inspect');
			inspections.push(args);
			return inspect(...args);
		}, tracker));
		return {
			events, pickerOptions, dialogsShown, errors, inspections, inventoryWaiting: inventoryWaiting.p,
			setSelection: (next: Promise<URI[] | undefined>) => { selection = next; },
			setInspector: (next: LocalVsixInspector) => { inspect = next; },
			setStat: (next: Partial<typeof returnedStat>) => { returnedStat = { ...returnedStat, ...next }; },
			setInventory: (next: IExtension[]) => { cached = next; },
			onPostStat: (callback: () => void) => { postStatEffect = callback; },
			getInventoryReads: () => inventoryReads,
			switchProfile: () => profiles.updateCurrentProfile(profileB),
			removeProvider: () => {
				shouldHaveProvider = false;
				registrationChanges.fire({ added: false, scheme: Schemas.file });
			},
			cancelProgress: () => { assert.ok(cancelProgress); cancelProgress(); },
			dispose: () => registration.dispose(),
			run: (...args: unknown[]) => instantiation.invokeFunction(CommandsRegistry.getCommand(commandId)!.handler, ...args),
		};
	}

	test('registers a local-only Extensions menu entry without inspecting files or inventory', () => {
		const state = fixture();
		const [entry] = MenuRegistry.getMenuItems(MenuId.ViewContainerTitle).filter(isIMenuItem).filter(item => item.command.id === commandId);
		const context = (view: string, remote: string) => ({ getValue: <T>(key: string) => (key === 'viewContainer' ? view : remote) as T });
		assert.deepStrictEqual([
			entry.when?.evaluate(context(VIEWLET_ID, '')),
			entry.when?.evaluate(context(VIEWLET_ID, 'ssh-remote')),
			entry.when?.evaluate(context('other', '')),
			state.events,
		], [true, false, false, []]);
	});

	test('shows the inspected fingerprint and the latest cached version just after checking the selected file', async () => {
		const state = fixture();
		state.onPostStat(() => state.setInventory([installed('1.9.0')]));
		await state.run(URI.file('/fixtures/ignored.vsix'));
		const [picker] = state.pickerOptions;
		assert.deepStrictEqual([picker.availableFileSystems, picker.canSelectFiles, picker.canSelectFolders, picker.canSelectMany, picker.filters?.[0].extensions], [[Schemas.file], true, false, false, ['vsix']]);
		assert.deepStrictEqual(state.events, ['picker', 'stat', 'inspect', 'wait-cache', 'stat', 'read-cache']);
		assert.deepStrictEqual(state.inspections[0].slice(0, 2), [file, metadata.bytes]);
		assert.deepStrictEqual(state.errors, []);
		const [prompt] = state.dialogsShown;
		assert.strictEqual(prompt.custom, true);
		assert.strictEqual(prompt.buttons, undefined);
		const detail = prompt.detail ?? '';
		assert.match(detail, /Extension: fixture\.tool\nVSIX version: 1\.10\.0\+local\nVSIX SHA-256: (ab){32}/);
		assert.match(detail, /Active profile: Development\nCached installed version: 1\.9\.0\nThe VSIX version is newer/);
		assert.match(detail, /compatibility, signatures, and other profiles' use of shared extension files/);
	});

	test('compares exact and ordered versions, ignores build metadata for precedence, and orders long numeric prereleases exactly', () => {
		const cases = [
			['1.2.0+abc', '1.2.0+abc', 'exact'],
			['1.2.0+abc', '1.2.0+ABC', 'equalPrecedence'],
			['1.2.0+02', '1.2.0+1', 'equalPrecedence'],
			['1.2.0', '1.2.0+local', 'equalPrecedence'],
			['1.10.0', '1.2.0', 'newer'],
			['1.2.0', '1.2.0-beta.10', 'newer'],
			['1.2.0-beta.2', '1.2.0-beta.10', 'older'],
			['1.2.0-beta', '1.2.0-alpha', 'newer'],
			['1.2.0-beta.9007199254740992.z', '1.2.0-beta.9007199254740993.a', 'older'],
			['1.2.0-9007199254740993', '1.2.0-9007199254740992', 'newer'],
			['1.2.0-9007199254740993', '1.2.1-9007199254740992', 'older'],
		];
		for (const [selected, current, kind] of cases) {
			assert.deepStrictEqual(compareLocalVsixVersion(metadata.id, selected, [installed(current)]), { kind, installedVersion: current });
		}
	});

	test('reports ambiguous, invalid, nonlocal and out-of-scope cached entries as unknown', () => {
		const wrongScope: Partial<ILocalExtension>[] = [
			{ type: ExtensionType.System }, { isBuiltin: true }, { isValid: false }, { isApplicationScoped: true }, { isWorkspaceScoped: true },
			{ location: local.with({ authority: 'share' }) }, { location: local.with({ scheme: Schemas.vscodeRemote }) },
			{ manifest: { ...installed('1.0.0').local!.manifest, contributes: { localizations: [{ languageId: 'fixture', translations: [] }] } } },
		];
		const lists = [
			[], [installed('1.0.0', { identifier: { id: 'fixture.other' } })], [installed('v1.0.0')], [installed('1.0.0-01')],
			[installed('1.0.0'), installed('2.0.0')], [installed('1.0.0', {}, ExtensionState.Uninstalling)],
			...wrongScope.map(entry => [installed('1.0.0', entry)]),
		];
		for (const entries of lists) {
			assert.deepStrictEqual(compareLocalVsixVersion(metadata.id, metadata.version, entries), { kind: 'unknown' });
		}
	});

	test('rejects untrusted selection shapes before inspection and leaves the remote command inert', async () => {
		const state = fixture();
		state.setSelection(Promise.resolve(undefined));
		await state.run(file);
		for (const selection of [
			[file, file], [file.with({ scheme: Schemas.vscodeRemote })], [file.with({ query: 'query' })], [file.with({ authority: 'network' })],
			[file.with({ fragment: 'fragment' })], [file.with({ path: '/fixtures/../selected.vsix' })], [file.with({ path: '/fixtures/selected.txt' })],
		]) {
			state.setSelection(Promise.resolve(selection));
			await state.run();
		}
		assert.deepStrictEqual([state.events, state.errors.length, state.dialogsShown.length, state.getInventoryReads()], [Array(8).fill('picker'), 7, 0, 0]);
		state.dispose();
		const remote = fixture({ remote: true });
		await remote.run(file);
		assert.deepStrictEqual(remote.events, []);
	});

	test('rejects a symbolic link or out-of-bounds size before opening the native snapshot', async () => {
		const state = fixture();
		for (const stat of [
			{ type: FileType.File | FileType.SymbolicLink }, { type: FileType.File, size: 21 }, { size: 32 * 1024 * 1024 + 1 }, { size: 22.5 },
		]) {
			state.setStat(stat);
			await state.run();
		}
		assert.deepStrictEqual([state.errors.length, state.inspections.length, state.dialogsShown.length, state.getInventoryReads()], [4, 0, 0, 0]);
	});

	test('shows the file version but keeps the inventory unknown when no matching cache or confirmed profile is available', async () => {
		const state = fixture({ installed: [] });
		await state.run();
		await state.switchProfile();
		state.setInventory([installed('1.2.0')]);
		await state.run();
		assert.strictEqual(state.getInventoryReads(), 1);
		assert.deepStrictEqual(state.dialogsShown.map(prompt => /Cached installed version: Unknown/.test(prompt.detail ?? '')), [true, true]);
		assert.match(state.dialogsShown[1].detail ?? '', /Active profile: Other/);
		state.dispose();

		const failedInit = fixture({ initialized: Promise.resolve().then(() => { throw new Error('private init error'); }) });
		await failedInit.run();
		assert.strictEqual(failedInit.getInventoryReads(), 0);
		assert.match(failedInit.dialogsShown[0].detail ?? '', /Cached installed version: Unknown/);
		assert.doesNotMatch(failedInit.dialogsShown[0].detail ?? '', /private init error/);
	});

	test('cancels across profile switches and a pending cache, then admits another request', async () => {
		const initialized = new DeferredPromise<void>();
		const state = fixture({ initialized: initialized.p });
		const pending = state.run();
		await state.inventoryWaiting;
		await state.run(); // Another dispatch cannot overlap the first request.
		assert.strictEqual(state.pickerOptions.length, 1);
		await state.switchProfile();
		await pending;
		assert.strictEqual(state.inspections[0][2].isCancellationRequested, true);
		assert.deepStrictEqual([state.dialogsShown.length, state.errors.length, state.getInventoryReads()], [0, 0, 0]);
		await initialized.complete();
		await state.run();
		assert.deepStrictEqual([state.pickerOptions.length, state.dialogsShown.length, state.getInventoryReads()], [2, 1, 0]);
	});

	test('drops delayed picker, inspection, and final-stat results on disposal, progress cancel, and provider replacement', async () => {
		const opening = fixture();
		const selection = new DeferredPromise<URI[]>();
		opening.setSelection(selection.p);
		const pickerPending = opening.run();
		opening.dispose();
		await selection.complete([file]);
		await pickerPending;
		assert.deepStrictEqual(opening.events, ['picker']);

		const cancelled = fixture();
		cancelled.setInspector(async () => {
			cancelled.cancelProgress();
			return metadata;
		});
		await cancelled.run();
		assert.strictEqual(cancelled.inspections[0][2].isCancellationRequested, true);
		cancelled.dispose();

		const replaced = fixture();
		replaced.onPostStat(() => replaced.removeProvider());
		await replaced.run();
		for (const state of [opening, cancelled, replaced]) {
			assert.deepStrictEqual([state.dialogsShown.length, state.errors.length, state.getInventoryReads()], [0, 0, 0]);
		}
	});

	test('drops the old archive on metadata changes or an invalid native result', async () => {
		const changed = fixture();
		changed.onPostStat(() => changed.setStat({ mtime: 2 }));
		await changed.run();
		changed.dispose();
		const invalid = fixture();
		invalid.setInspector(async () => ({ ...metadata, bytes: metadata.bytes + 1 }));
		await invalid.run();
		for (const state of [changed, invalid]) {
			assert.deepStrictEqual([state.dialogsShown.length, state.errors.length, state.getInventoryReads()], [0, 1, 0]);
		}
	});
});
