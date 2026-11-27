/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { LibraryTextEntry } from './libraryModel';

export const maxSearchQueryLength = 256;
const batchEntries = 32;
const batchCharacters = 256 * 1024;

interface SearchDocument {
	index: number;
	title: string;
	format: LibraryTextEntry['format'];
	selector?: string;
	text: string;
}

export async function readSearchBatch(
	count: number,
	offset: number,
	entryAt: (index: number) => LibraryTextEntry,
	read: (entry: LibraryTextEntry) => Promise<string>,
	isCurrent: () => boolean,
): Promise<{ offset: number; skipped: number; documents: SearchDocument[] } | undefined> {
	const documents: SearchDocument[] = [];
	let skipped = 0;
	let characters = 0;
	const end = Math.min(count, offset + batchEntries);
	while (offset < end && characters < batchCharacters) {
		if (!isCurrent()) { return undefined; }
		const entry = entryAt(offset);
		try {
			const text = await read(entry);
			if (!isCurrent()) { return undefined; }
			documents.push({ index: offset, title: entry.title.slice(0, 256).toWellFormed(), format: /\.md$/i.test(entry.file) ? 'markdown' : entry.format,
				selector: entry.selector, text });
			characters += text.length;
		} catch {
			skipped++;
		}
		offset++;
	}
	return isCurrent() ? { offset, skipped, documents } : undefined;
}
