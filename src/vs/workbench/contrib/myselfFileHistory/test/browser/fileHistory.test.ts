/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { extUri } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkingCopyHistoryEntry, IWorkingCopyHistoryService } from '../../../../services/workingCopy/common/workingCopyHistory.js';
import { LocalHistoryFileSystemProvider } from '../../../localHistory/browser/localHistoryFileSystemProvider.js';
import { FileHistoryPreviewContext } from '../../browser/fileHistory.contribution.js';

class FileInput extends EditorInput {
	override readonly typeId = 'test.fileHistory';
	constructor(private uri: URI) { super(); }
	override get resource(): URI { return this.uri; }
	changeResource(uri: URI): void { this.uri = uri; this._onDidChangeLabel.fire(); }
}

suite('Current file history preview', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const resource = URI.file('/project/second-folder/file.txt');
	const other = URI.file('/project/first-folder/file.txt');

	function entry(id = 'saved.txt', target = resource): IWorkingCopyHistoryEntry {
		return { id, workingCopy: { resource: target, name: 'file.txt' }, location: URI.file(`/local-history/${id}`), timestamp: 1000, source: 'fileSaved.source', sourceDescription: undefined };
	}

	function fixture() {
		let active: EditorInput | undefined = store.add(new FileInput(resource));
		let entries = [entry()];
		let enabled = true;
		let choice: number | undefined = 0;
		let readEntries = async () => entries;
		let beforePick = async () => { };
		let onCommand = async () => { };
		const reads: URI[] = [];
		const calls: { id: string; args: object[] }[] = [];
		const notices: string[] = [];
		const picks: IQuickPickItem[][] = [];
		const changed = store.add(new Emitter<void>());
		const editors = new class extends mock<IEditorService>() {
			override get activeEditor(): EditorInput | undefined { return active; }
			override readonly onDidActiveEditorChange = changed.event;
		}();
		const history = new class extends mock<IWorkingCopyHistoryService>() {
			override async getEntries(uri: URI): Promise<readonly IWorkingCopyHistoryEntry[]> {
				reads.push(uri);
				return readEntries();
			}
		}();
		const configuration = new class extends mock<IConfigurationService>() {
			override getValue<T>(): T { return enabled as T; }
		}();
		const picker = upcastPartial<IQuickInputService>({
			pick: (async (items: IQuickPickItem[]) => {
				picks.push(items);
				await beforePick();
				return choice === undefined ? undefined : items[choice];
			}) as IQuickInputService['pick'],
		});
		const commands = new class extends mock<ICommandService>() {
			override async executeCommand<T>(id: string, ...args: object[]): Promise<T> {
				calls.push({ id, args });
				await onCommand();
				return undefined as T;
			}
		}();
		const noticesService = new class extends mock<INotificationService>() {
			override info(text: string): void { notices.push(text); }
		}();
		const identity = upcastPartial<IUriIdentityService>({ extUri });
		const services = new ServiceCollection([IEditorService, editors], [IWorkingCopyHistoryService, history], [IConfigurationService, configuration], [IQuickInputService, picker], [ICommandService, commands], [INotificationService, noticesService], [IUriIdentityService, identity]);
		const instantiation = store.add(new InstantiationService(services, true));
		const run = (id: string, ...args: object[]) => Promise.resolve(instantiation.invokeFunction(CommandsRegistry.getCommand(id)!.handler, ...args));
		const file = (uri: URI) => store.add(new FileInput(uri));
		const setActive = (editor: EditorInput | undefined) => { active = editor; changed.fire(); };
		const diff = (original = LocalHistoryFileSystemProvider.toLocalHistoryFileSystem({ location: entry().location, associatedResource: resource }), modified = resource) => store.add(new DiffEditorInput(undefined, undefined, file(original), file(modified), undefined, editors));
		return {
			run, reads, calls, notices, picks, editors, identity, file, diff, setActive,
			setEntries: (value: IWorkingCopyHistoryEntry[]) => { entries = value; },
			setEnabled: (value: boolean) => { enabled = value; },
			setChoice: (value: number | undefined) => { choice = value; },
			setReadEntries: (value: () => Promise<IWorkingCopyHistoryEntry[]>) => { readEntries = value; },
			setBeforePick: (value: () => Promise<void>) => { beforePick = value; },
			setCommand: (value: () => Promise<void>) => { onCommand = value; },
		};
	}

	test('Timeline receives the active resource, ignoring arbitrary command arguments and other roots', async () => {
		const state = fixture();
		await state.run('myself.fileHistory.open', other);
		assert.deepStrictEqual({ calls: state.calls, reads: state.reads }, { calls: [{ id: 'files.openTimeline', args: [resource] }], reads: [] });
	});

	test('preview chooses a saved entry of the active file and never restores it automatically', async () => {
		const state = fixture();
		state.setEntries([entry('older.txt'), { ...entry('newer.txt'), timestamp: 2000 }]);
		state.setChoice(1);
		await state.run('myself.fileHistory.preview', other);
		assert.deepStrictEqual({ reads: state.reads, calls: state.calls }, { reads: [resource], calls: [{ id: 'workbench.action.localHistory.compareWithFile', args: [{ uri: resource, handle: 'older.txt' }] }] });
	});

	test('preview excludes entries associated with another root or a nonlocal snapshot', async () => {
		const state = fixture();
		state.setEntries([entry('foreign.txt', other), { ...entry(), location: URI.parse('custom:/history/saved.txt') }]);
		await state.run('myself.fileHistory.preview');
		assert.deepStrictEqual({ calls: state.calls, picks: state.picks.length, notices: state.notices.length }, { calls: [], picks: 0, notices: 1 });
	});

	for (const uri of [undefined, URI.parse('untitled:Untitled-1'), URI.parse('vscode-remote://host/project/file.txt'), URI.parse('custom:/project/file.txt'), URI.file('//server/share/file.txt')]) {
		test(`preview refuses unsupported or missing active resource ${uri?.scheme ?? 'none'} before history read`, async () => {
			const state = fixture();
			state.setActive(uri ? state.file(uri) : undefined);
			await state.run('myself.fileHistory.preview', resource);
			assert.deepStrictEqual({ reads: state.reads, calls: state.calls, notices: state.notices.length }, { reads: [], calls: [], notices: 1 });
		});
	}

	test('disabled history, no entries and picker cancellation never dispatch a comparison or restore', async () => {
		for (const mode of ['disabled', 'empty', 'cancel']) {
			const state = fixture();
			state.setEnabled(mode !== 'disabled');
			if (mode === 'empty') { state.setEntries([]); }
			if (mode === 'cancel') { state.setChoice(undefined); }
			await state.run('myself.fileHistory.preview');
			assert.deepStrictEqual({ calls: state.calls, picks: state.picks.length }, { calls: [], picks: mode === 'cancel' ? 1 : 0 });
		}
	});

	test('preview does not treat a Git diff as the ordinary active file', async () => {
		const state = fixture();
		state.setActive(state.diff(resource.with({ scheme: 'git' })));
		await state.run('myself.fileHistory.preview', resource);
		assert.deepStrictEqual({ reads: state.reads, calls: state.calls }, { reads: [], calls: [] });
	});

	test('preview aborts if the editor or resource changes while history or selection is pending', async () => {
		for (const stage of ['history', 'picker']) {
			const state = fixture();
			if (stage === 'history') {
				state.setReadEntries(async () => { state.setActive(state.file(other)); return [entry()]; });
			} else {
				state.setBeforePick(async () => { state.setActive(state.file(other)); });
			}
			await state.run('myself.fileHistory.preview');
			assert.deepStrictEqual(state.calls, []);
		}
	});

	test('restore delegates the active local preview and verified descriptor to the standard confirmation path', async () => {
		const state = fixture();
		state.setActive(state.diff());
		await state.run('myself.fileHistory.restorePreview', { uri: other, handle: 'injected' });
		assert.deepStrictEqual({ reads: state.reads, calls: state.calls }, { reads: [resource], calls: [{ id: 'workbench.action.localHistory.restore', args: [{ uri: resource, handle: 'saved.txt' }] }] });
	});

	for (const query of ['', '{', '{}', 'null', '{"location":7,"associatedResource":false}', JSON.stringify({ location: 'custom:/saved.txt', associatedResource: resource.toString() }), JSON.stringify({ location: entry().location.toString(), associatedResource: other.toString() })]) {
		test(`restore rejects an invalid preview descriptor before history read (${query})`, async () => {
			const state = fixture();
			state.setActive(state.diff(URI.from({ scheme: LocalHistoryFileSystemProvider.SCHEMA, path: resource.path, query })));
			await state.run('myself.fileHistory.restorePreview');
			assert.deepStrictEqual({ reads: state.reads, calls: state.calls }, { reads: [], calls: [] });
		});
	}

	test('normal, Git and reversed diffs cannot dispatch restore, including direct invocation', async () => {
		const state = fixture();
		const snapshot = LocalHistoryFileSystemProvider.toLocalHistoryFileSystem({ location: entry().location, associatedResource: resource });
		for (const editor of [state.file(resource), state.diff(resource.with({ scheme: 'git' })), state.diff(resource, snapshot)]) {
			state.setActive(editor);
			await state.run('myself.fileHistory.restorePreview', { uri: resource, handle: 'saved.txt' });
		}
		assert.deepStrictEqual({ reads: state.reads, calls: state.calls }, { reads: [], calls: [] });
	});

	test('deleted entries, matching IDs at foreign locations and entries for another root never restore', async () => {
		for (const entries of [[], [{ ...entry(), location: URI.file('/foreign/saved.txt') }], [entry('saved.txt', other)], [entry('other.txt')]]) {
			const state = fixture();
			state.setEntries(entries);
			state.setActive(state.diff());
			await state.run('myself.fileHistory.restorePreview');
			assert.deepStrictEqual(state.calls, []);
		}
	});

	test('restore rechecks active input and both resources after asynchronous history lookup', async () => {
		for (const change of ['input', 'original', 'modified']) {
			const state = fixture();
			const preview = state.diff();
			state.setActive(preview);
			state.setReadEntries(async () => {
				if (change === 'input') { state.setActive(state.diff()); }
				if (change === 'original') { (preview.original as FileInput).changeResource(URI.parse('git:/other')); }
				if (change === 'modified') { (preview.modified as FileInput).changeResource(other); }
				return [entry()];
			});
			await state.run('myself.fileHistory.restorePreview');
			assert.deepStrictEqual(state.calls, []);
		}
	});

	test('repeated restore clicks for the same file cannot overlap while native confirmation is pending', async () => {
		const state = fixture();
		const confirmation = new DeferredPromise<void>();
		const invoked = new DeferredPromise<void>();
		state.setCommand(async () => { await invoked.complete(); await confirmation.p; });
		state.setActive(state.diff());
		const first = state.run('myself.fileHistory.restorePreview');
		await invoked.p;
		state.setActive(state.diff());
		await state.run('myself.fileHistory.restorePreview');
		assert.strictEqual(state.calls.length, 1);
		await confirmation.complete();
		await first;
		await state.run('myself.fileHistory.restorePreview');
		assert.strictEqual(state.calls.length, 2);
	});

	test('passive preview context follows real input changes and disposal without history or command calls', () => {
		const state = fixture();
		const keys = store.add(new MockContextKeyService());
		const context = store.add(new FileHistoryPreviewContext(state.editors, keys, state.identity));
		assert.strictEqual(keys.getContextKeyValue('myselfFileHistoryHasPreview'), false);
		const preview = state.diff();
		state.setActive(preview);
		assert.strictEqual(keys.getContextKeyValue('myselfFileHistoryHasPreview'), true);
		(preview.modified as FileInput).changeResource(other);
		assert.strictEqual(keys.getContextKeyValue('myselfFileHistoryHasPreview'), false);
		(preview.modified as FileInput).changeResource(resource);
		assert.strictEqual(keys.getContextKeyValue('myselfFileHistoryHasPreview'), true);
		preview.dispose();
		assert.strictEqual(keys.getContextKeyValue('myselfFileHistoryHasPreview'), false);
		context.dispose();
		assert.deepStrictEqual({ reads: state.reads, calls: state.calls }, { reads: [], calls: [] });
	});

	test('history lookup and native command failures release the per-file restore guard', async () => {
		for (const stage of ['history', 'command']) {
			const state = fixture();
			state.setActive(state.diff());
			const error = new Error('temporary failure');
			if (stage === 'history') { state.setReadEntries(async () => { throw error; }); }
			if (stage === 'command') { state.setCommand(async () => { throw error; }); }
			await assert.rejects(state.run('myself.fileHistory.restorePreview'), error);
			state.setReadEntries(async () => [entry()]);
			state.setCommand(async () => { });
			await state.run('myself.fileHistory.restorePreview');
			assert.strictEqual(state.calls.length, stage === 'history' ? 1 : 2);
		}
	});

	test('menus offer current-file history separately from the restore-only preview title action', () => {
		const restore = MenuRegistry.getMenuItems(MenuId.EditorTitle).filter(isIMenuItem).find(item => item.command.id === 'myself.fileHistory.restorePreview');
		assert.ok(restore?.when?.serialize().includes('myselfFileHistoryHasPreview'));
		assert.strictEqual(CommandsRegistry.getCommand('myself.fileHistory.preview') !== undefined, true);
	});
});
