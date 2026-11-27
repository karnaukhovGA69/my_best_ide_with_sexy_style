/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { TextEditor } from 'vscode';
import type { LibraryEntry } from './libraryModel';

interface DocumentationTopic {
	readonly group: string;
	readonly file: string;
	readonly fragment?: string;
}

const referenceTopics: ReadonlyMap<string, DocumentationTopic> = new Map([
	['go', { group: 'go', file: 'go/go-spec.html' }],
	['rust', { group: 'rust', file: 'rust/rust-reference.html' }],
	['sql', { group: 'postgresql', file: 'postgresql/index.html' }],
	['shellscript', { group: 'bash', file: 'bash/bash.html' }],
]);
const maxTermLength = 64;
const identifier = /[\p{L}\p{M}\p{N}_$]+/gu;
const sqlTopic = /(?<![\p{L}\p{M}\p{N}_$])CREATE[ \t]+TABLE(?![\p{L}\p{M}\p{N}_$])|[\p{L}\p{M}\p{N}_$]+/giu;

export function hasContextHelp(language: string): boolean {
	return referenceTopics.has(language);
}

/** Reads a bounded range from the active editor after the user requests help. */
export function contextHelpTerm(editor: TextEditor): string {
	const { document, selection } = editor;
	const language = document.languageId;
	if (language !== 'go' && language !== 'sql') { return ''; }
	const range = selection.isEmpty ? document.getWordRangeAtPosition(selection.active, language === 'sql' ? sqlTopic : identifier) : selection;
	if (!range || document.offsetAt(range.end) - document.offsetAt(range.start) > maxTermLength) { return ''; }
	return document.getText(range).trim();
}

export function findContextHelp(entries: readonly LibraryEntry[], language: string, term: string): { entry: LibraryEntry; fragment: string } | undefined {
	const reference = referenceTopics.get(language);
	if (!reference) { return undefined; }

	let exact: DocumentationTopic | undefined;
	if (language === 'go' && term === 'map') {
		exact = { ...reference, fragment: 'Map_types' };
	} else if (language === 'sql' && /^[a-z \t\r\n]+$/i.test(term)) {
		switch (term.replace(/[ \t\r\n]+/g, ' ').toUpperCase()) {
			case 'SELECT':
				exact = { group: 'postgresql', file: 'postgresql/sql-select.html' };
				break;
			case 'CREATE TABLE':
				exact = { group: 'postgresql', file: 'postgresql/sql-createtable.html' };
				break;
		}
	}
	const find = (topic: DocumentationTopic) => {
		const entry = entries.find(entry => entry.group === topic.group && entry.file === topic.file && (entry.format === 'html' || entry.format === 'markdown'));
		return entry && { entry, fragment: topic.fragment ?? '' };
	};
	return (exact && find(exact)) ?? find(reference);
}
