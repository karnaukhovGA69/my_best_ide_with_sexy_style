/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escapeIcons } from '../../../../base/common/iconLabels.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import type { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, type IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { WorkbenchStateContext } from '../../../common/contextkeys.js';
import { VIEW_ID } from '../../files/common/files.js';
import { ProjectNotes, projectNoteLimit, type ProjectNote } from '../common/projectNotes.js';

type NotesItem = IQuickPickItem & ({ readonly action: 'addNote' | 'addTodo' } | { readonly action: 'open'; readonly note: ProjectNote });
type NoteAction = IQuickPickItem & { readonly action: 'edit' | 'toggle' | 'remove' };

registerAction2(class extends Action2 {
	private running = false;

	constructor() {
		super({
			id: 'myself.project.notes',
			title: localize2('projectNotes', "Project Notes"),
			precondition: WorkbenchStateContext.notEqualsTo('empty'),
			menu: [
				{ id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', VIEW_ID), group: '3_project' },
				{ id: MenuId.MenubarViewMenu, group: '4_panels', order: 40 },
			],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const workspace = accessor.get(IWorkspaceContextService);
		if (this.running || workspace.getWorkbenchState() === WorkbenchState.EMPTY) {
			return;
		}
		const quickInput = accessor.get(IQuickInputService);
		const dialogs = accessor.get(IDialogService);
		const notifications = accessor.get(INotificationService);
		const notes = new ProjectNotes(accessor.get(IStorageService));
		const id = workspace.getWorkspace().id;
		const isCurrent = () => workspace.getWorkbenchState() !== WorkbenchState.EMPTY && workspace.getWorkspace().id === id;

		this.running = true;
		try {
			const items: NotesItem[] = [
				{ action: 'addNote', label: localize('addProjectNote', "Add Note…"), alwaysShow: true },
				{ action: 'addTodo', label: localize('addProjectTodo', "Add To-do…"), alwaysShow: true },
			];
			const statuses = { note: localize('noteStatus', "Note"), open: localize('openTodo', "To-do"), done: localize('completedTodo', "Done") };
			for (const note of notes.list()) {
				items.push({ action: 'open', note, label: escapeIcons(note.text), description: statuses[note.status] });
			}
			const picked = await quickInput.pick(items, { placeHolder: localize('pickProjectNote', "Select a note or add an item to this project") });
			if (!picked || !isCurrent()) {
				return;
			}
			if (picked.action !== 'open') {
				const text = await this.readText(quickInput);
				if (text !== undefined && isCurrent()) {
					notes.add(text, picked.action === 'addTodo');
				}
				return;
			}

			const note = picked.note;
			const actions: NoteAction[] = [{ action: 'edit', label: localize('editProjectNote', "Edit…") }];
			if (note.status !== 'note') {
				actions.push({ action: 'toggle', label: note.status === 'done' ? localize('reopenTodo', "Reopen To-do") : localize('completeTodo', "Mark Done") });
			}
			actions.push({ action: 'remove', label: localize('deleteProjectNote', "Delete…") });
			const choice = await quickInput.pick(actions, { placeHolder: escapeIcons(note.text) });
			if (!choice || !isCurrent()) {
				return;
			}
			let changed: boolean;
			switch (choice.action) {
				case 'edit': {
					const text = await this.readText(quickInput, note.text);
					if (text === undefined || !isCurrent()) {
						return;
					}
					changed = notes.edit(note, text);
					break;
				}
				case 'toggle':
					changed = notes.toggle(note);
					break;
				case 'remove': {
					const confirmation = await dialogs.confirm({
						message: localize('deleteProjectNoteConfirm', "Delete this project note?"),
						detail: note.text,
						primaryButton: localize('deleteProjectNoteButton', "&&Delete"),
					});
					if (!confirmation.confirmed || !isCurrent()) {
						return;
					}
					changed = notes.remove(note);
					break;
				}
			}
			if (!changed) {
				notifications.info(localize('projectNoteChanged', "This note has changed. Open Project Notes to view the current version."));
			}
		} finally {
			this.running = false;
		}
	}

	private readText(quickInput: IQuickInputService, value?: string): Promise<string | undefined> {
		return quickInput.input({
			value,
			prompt: localize('projectNoteText', "Enter one line of text for this project"),
			validateInput: async text => !text.trim()
				? localize('projectNoteRequired', "Enter some text.")
				: text.length > projectNoteLimit || /[\r\n]/.test(text)
					? localize('projectNoteTextLimit', "Use one line up to {0} characters.", projectNoteLimit)
					: undefined,
		});
	}
});
