/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const reviewStorageKey = 'localReview.state';
export const maxNoteLength = 4000;
export const maxChecklistLength = 300;

const maxNotes = 200;
const maxChecklistItems = 100;

export type ReviewRange = readonly [startLine: number, startCharacter: number, endLine: number, endCharacter: number];

interface RecordIdentity {
	readonly id: string;
	readonly revision: string;
}

export interface ReviewNote extends RecordIdentity {
	readonly resource: string;
	readonly root: string;
	readonly range: ReviewRange;
	readonly anchor: string;
	readonly body: string;
	readonly resolved: boolean;
}

export interface ReviewCheck extends RecordIdentity {
	readonly label: string;
	readonly checked: boolean;
}

export interface ReviewState {
	readonly version: 1;
	readonly notes: readonly ReviewNote[];
	readonly checks: readonly ReviewCheck[];
}

interface ReviewMemento {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function reviewText(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string' || value.length > limit) {
		return undefined;
	}
	const text = value.replace(/\r\n?/g, '\n').trim();
	return text && !/[\p{Cc}\p{Bidi_Control}]/u.test(text.replace(/[\n\t]/g, '')) ? text : undefined;
}

function isId(value: unknown): value is string {
	return typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
}

function isRange(value: unknown): value is ReviewRange {
	if (!Array.isArray(value) || value.length !== 4 || value.some(n => !Number.isSafeInteger(n) || n < 0 || n > 10_000_000)) {
		return false;
	}
	const [startLine, startCharacter, endLine, endCharacter] = value;
	return endLine >= startLine && endLine - startLine <= 200
		&& (endLine > startLine || endCharacter >= startCharacter);
}

function isFileIdentifier(value: unknown): value is string {
	return typeof value === 'string' && value.length <= 4096 && value.startsWith('file:');
}

function isNote(value: unknown): value is ReviewNote {
	const note = record(value);
	return !!note && isId(note.id) && isId(note.revision) && isFileIdentifier(note.resource) && isFileIdentifier(note.root)
		&& isRange(note.range) && typeof note.anchor === 'string' && /^[0-9a-f]{64}$/.test(note.anchor)
		&& typeof note.body === 'string' && reviewText(note.body, maxNoteLength) === note.body && typeof note.resolved === 'boolean';
}

function isCheck(value: unknown): value is ReviewCheck {
	const check = record(value);
	return !!check && isId(check.id) && isId(check.revision) && typeof check.label === 'string'
		&& reviewText(check.label, maxChecklistLength) === check.label && typeof check.checked === 'boolean';
}

export function decodeReviewState(value: unknown): ReviewState | undefined {
	const state = record(value);
	if (!state || state.version !== 1 || !Array.isArray(state.notes) || !Array.isArray(state.checks)
		|| state.notes.length > maxNotes || state.checks.length > maxChecklistItems
		|| !state.notes.every(isNote) || !state.checks.every(isCheck)) {
		return undefined;
	}
	const ids = [...state.notes, ...state.checks].map(entry => entry.id);
	if (new Set(ids).size !== ids.length) {
		return undefined;
	}
	return { version: 1, notes: state.notes, checks: state.checks };
}

function replace<T extends RecordIdentity>(items: readonly T[], expected: T, replacement: T | undefined): readonly T[] | undefined {
	const actual = items.find(item => item.id === expected.id);
	if (!actual || actual.revision !== expected.revision || (replacement && replacement.id !== actual.id)) {
		return undefined;
	}
	return replacement ? items.map(item => item === actual ? replacement : item) : items.filter(item => item !== actual);
}

/** Serializes local updates and rejects edits to records replaced while a dialog was open. */
export class ReviewStore {
	private queue = Promise.resolve();
	private current: ReviewState | undefined;

	constructor(private readonly storage: ReviewMemento) {
		const value = storage.get<unknown>(reviewStorageKey);
		this.current = value === undefined ? { version: 1, notes: [], checks: [] } : decodeReviewState(value);
	}

	get state(): ReviewState | undefined {
		return this.current;
	}

	addNote(note: ReviewNote, stillValid: () => boolean): Promise<boolean> {
		return this.change(state => stillValid() ? { ...state, notes: [...state.notes, note] } : undefined);
	}

	changeNote(expected: ReviewNote, replacement: ReviewNote | undefined): Promise<boolean> {
		return this.change(state => {
			const notes = replace(state.notes, expected, replacement);
			return notes && { ...state, notes };
		});
	}

	addCheck(check: ReviewCheck): Promise<boolean> {
		return this.change(state => ({ ...state, checks: [...state.checks, check] }));
	}

	changeCheck(expected: ReviewCheck, replacement: ReviewCheck | undefined): Promise<boolean> {
		return this.change(state => {
			const checks = replace(state.checks, expected, replacement);
			return checks && { ...state, checks };
		});
	}

	private change(update: (state: ReviewState) => ReviewState | undefined): Promise<boolean> {
		const pending = this.queue.then(async () => {
			const next = this.current && decodeReviewState(update(this.current));
			if (!next) {
				return false;
			}
			await this.storage.update(reviewStorageKey, next);
			this.current = next;
			return true;
		});
		this.queue = pending.then(() => undefined, () => undefined);
		return pending;
	}
}
