/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { maxDocumentBytes, safeRelativeFile } from './libraryModel';

export interface ImportedDocument { relative: string; bytes: Uint8Array }
export const folderImportLimits = { documents: 5000, entries: 20000, bytes: 64 * 1024 * 1024, depth: 32 };

/** Reads an explicitly selected local directory. Links never expand the selected set. */
export async function readDocumentationFolder(folder: string, cancelled: () => boolean, limits = folderImportLimits): Promise<ImportedDocument[]> {
	const root = await fs.realpath(folder);
	const documents: ImportedDocument[] = [];
	let entries = 0, bytes = 0;
	const check = () => { if (cancelled()) { throw new Error('Cancelled'); } };
	const inside = (file: string) => { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
	async function visit(directory: string, depth: number): Promise<void> {
		check();
		if (depth > limits.depth || !inside(await fs.realpath(directory))) { throw new Error('Folder limit'); }
		const handle = await fs.opendir(directory);
		for await (const entry of handle) {
			check();
			if (++entries > limits.entries) { throw new Error('Entry limit'); }
			if (entry.isSymbolicLink()) { continue; }
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== '.git' && entry.name !== 'node_modules') { await visit(file, depth + 1); }
			} else if (entry.isFile() && /\.(html?|md|txt)$/i.test(entry.name)) {
				const relative = path.relative(root, file).split(path.sep).join('/');
				if (!safeRelativeFile(relative) || !inside(await fs.realpath(file))) { throw new Error('Invalid document path'); }
				const source = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
				try {
					const stat = await source.stat();
					if (!stat.isFile() || stat.size > maxDocumentBytes || bytes + stat.size > limits.bytes || documents.length >= limits.documents) { throw new Error('Document limit'); }
					check();
					// Reject a growing source instead of allocating beyond its validated snapshot size.
					const buffer = Buffer.alloc(stat.size + 1);
					let length = 0;
					while (length < buffer.length) {
						check();
						const result = await source.read(buffer, length, buffer.length - length, null);
						if (!result.bytesRead) { break; }
						length += result.bytesRead;
					}
					if (length > stat.size || length > maxDocumentBytes || bytes + length > limits.bytes) { throw new Error('Document limit'); }
					const data = Uint8Array.from(buffer.subarray(0, length));
					new TextDecoder('utf-8', { fatal: true }).decode(data);
					bytes += length; documents.push({ relative, bytes: data });
				} finally { await source.close(); }
			}
		}
	}
	await visit(root, 0); check();
	return documents.sort((a, b) => a.relative.localeCompare(b.relative));
}
