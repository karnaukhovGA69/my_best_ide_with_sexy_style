/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputService, type IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { IStorageService, InMemoryStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import '../../browser/projectNotes.contribution.js';
import { ProjectNotes } from '../../common/projectNotes.js';

suite('Project Notes', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps duplicate items independently in local workspace storage', () => {
		const storage = store.add(new InMemoryStorageService());
		const notes = new ProjectNotes(storage);
		assert.ok(notes.add('Review imports', true));
		assert.ok(notes.add('Review imports', true));
		const [first, second] = new ProjectNotes(storage).list();
		assert.ok(notes.toggle(first));
		assert.ok(notes.edit(second, 'Review types'));
		assert.deepStrictEqual(new ProjectNotes(storage).list().map(item => [item.text, item.status]), [
			['Review imports', 'done'],
			['Review types', 'open'],
		]);
		assert.deepStrictEqual(storage.keys(StorageScope.WORKSPACE, StorageTarget.USER), []);
		assert.deepStrictEqual(storage.keys(StorageScope.PROFILE, StorageTarget.MACHINE), []);
	});

	test('rejects a delayed edit or deletion after that item changes', () => {
		const storage = store.add(new InMemoryStorageService());
		const notes = new ProjectNotes(storage);
		notes.add('Important', false);
		const [old] = notes.list();
		assert.ok(notes.edit(old, 'Important, updated'));
		assert.strictEqual(notes.remove(old), false);
		const [current] = notes.list();
		assert.ok(notes.remove(current));
		assert.strictEqual(notes.edit(current, 'Restore accidentally'), false);
		assert.deepStrictEqual(notes.list(), []);
	});

	function setupAction() {
		const service = store.add(new TestInstantiationService());
		const storage = store.add(new InMemoryStorageService());
		const state = { id: 'first' };
		service.stub(IStorageService, storage);
		service.stub(IWorkspaceContextService, {
			getWorkbenchState: () => WorkbenchState.FOLDER,
			getWorkspace: () => ({ id: state.id, folders: [], configuration: null }),
		});
		service.stub(INotificationService, {});
		const run = () => service.invokeFunction(CommandsRegistry.getCommand('myself.project.notes')!.handler);
		return { notes: new ProjectNotes(storage), service, state, run };
	}

	test('does not write new text to a different workspace after the input opens', async () => {
		const { notes, service, state, run } = setupAction();
		service.stub(IDialogService, {});
		service.stub(IQuickInputService, {}, 'pick', async (items: readonly IQuickPickItem[]) => items[0]);
		service.stub(IQuickInputService, {}, 'input', async () => {
			state.id = 'second';
			return 'Keep this in the first project';
		});
		await run();
		assert.deepStrictEqual(notes.list(), []);
	});

	test('cancelled confirmation keeps the chosen note', async () => {
		const { notes, service, run } = setupAction();
		notes.add('Keep me', false);
		let confirmed = 0;
		service.stub(IDialogService, { confirm: async () => { confirmed++; return { confirmed: false }; } });
		service.stub(IQuickInputService, {}, 'pick', async (items: readonly IQuickPickItem[]) => items.at(-1));
		await run();
		assert.strictEqual(confirmed, 1);
		assert.deepStrictEqual(notes.list().map(note => note.text), ['Keep me']);
	});
});
