/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid, isUUID } from '../../../../base/common/uuid.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

const keyPrefix = 'myself.projectNote.';
export const projectNoteLimit = 1000;

type NoteStatus = 'note' | 'open' | 'done';

interface ProjectNoteValue {
	readonly text: string;
	readonly status: NoteStatus;
	readonly created: number;
}

export interface ProjectNote extends ProjectNoteValue {
	readonly key: string;
}

function validText(text: unknown): text is string {
	return typeof text === 'string' && text.length <= projectNoteLimit && !!text.trim() && !/[\r\n]/.test(text);
}

/** Keep notes separate so adding or deleting one never rewrites the whole list. */
export class ProjectNotes {
	constructor(private readonly storage: Pick<IStorageService, 'keys' | 'getObject' | 'store' | 'remove'>) { }

	list(): ProjectNote[] {
		return this.storage.keys(StorageScope.WORKSPACE, StorageTarget.MACHINE)
			.flatMap(key => {
				const note = this.read(key);
				return note ? [note] : [];
			})
			.sort((a, b) => b.created - a.created || a.key.localeCompare(b.key));
	}

	add(text: string, isTodo: boolean): boolean {
		if (!validText(text)) {
			return false;
		}
		this.store(`${keyPrefix}${generateUuid()}`, { text: text.trim(), status: isTodo ? 'open' : 'note', created: Date.now() });
		return true;
	}

	edit(note: ProjectNote, text: string): boolean {
		if (!validText(text) || !this.matches(note)) {
			return false;
		}
		this.store(note.key, { text: text.trim(), status: note.status, created: note.created });
		return true;
	}

	toggle(note: ProjectNote): boolean {
		if (note.status === 'note' || !this.matches(note)) {
			return false;
		}
		this.store(note.key, { text: note.text, status: note.status === 'open' ? 'done' : 'open', created: note.created });
		return true;
	}

	remove(note: ProjectNote): boolean {
		if (!this.matches(note)) {
			return false;
		}
		this.storage.remove(note.key, StorageScope.WORKSPACE);
		return true;
	}

	private matches(note: ProjectNote): boolean {
		const current = this.read(note.key);
		return current?.created === note.created && current.text === note.text && current.status === note.status;
	}

	private read(key: string): ProjectNote | undefined {
		if (!key.startsWith(keyPrefix) || !isUUID(key.slice(keyPrefix.length))) {
			return undefined;
		}
		try {
			const note = this.storage.getObject<Partial<ProjectNoteValue>>(key, StorageScope.WORKSPACE);
			if (note && validText(note.text) && typeof note.created === 'number' && Number.isFinite(note.created)
				&& (note.status === 'note' || note.status === 'open' || note.status === 'done')) {
				return { key, text: note.text, status: note.status, created: note.created };
			}
		} catch {
			// A malformed record does not hide the rest of the notebook.
		}
		return undefined;
	}

	private store(key: string, value: ProjectNoteValue): void {
		this.storage.store(key, value, StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}
}
