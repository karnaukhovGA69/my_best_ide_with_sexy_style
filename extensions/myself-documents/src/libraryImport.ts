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

async function readDocument(file: string, remainingBytes: number, documentLimitReached: boolean, checkCancellation: () => void): Promise<Uint8Array> {
	const source = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const stat = await source.stat();
		if (!stat.isFile() || stat.size > maxDocumentBytes || stat.size > remainingBytes || documentLimitReached) {
			throw new Error('Document limit');
		}
		checkCancellation();
		// Read at most one extra byte to detect growth beyond the validated size.
		const buffer = Buffer.alloc(stat.size + 1);
		let length = 0;
		while (length < buffer.length) {
			checkCancellation();
			const { bytesRead } = await source.read(buffer, length, buffer.length - length, null);
			if (!bytesRead) {
				break;
			}
			length += bytesRead;
		}
		if (length > stat.size || length > maxDocumentBytes || length > remainingBytes) {
			throw new Error('Document limit');
		}
		const data = Uint8Array.from(buffer.subarray(0, length));
		new TextDecoder('utf-8', { fatal: true }).decode(data);
		return data;
	} finally {
		await source.close();
	}
}

/** Reads an explicitly selected local directory. Links never expand the selected set. */
export async function readDocumentationFolder(folder: string, cancelled: () => boolean, limits = folderImportLimits): Promise<ImportedDocument[]> {
	const root = await fs.realpath(folder);
	const documents: ImportedDocument[] = [];
	let entries = 0;
	let bytes = 0;
	const checkCancellation = () => {
		if (cancelled()) {
			throw new Error('Cancelled');
		}
	};
	const isInsideRoot = (file: string) => {
		const relative = path.relative(root, file);
		return !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
	};

	async function visit(directory: string, depth: number): Promise<void> {
		checkCancellation();
		if (depth > limits.depth || !isInsideRoot(await fs.realpath(directory))) {
			throw new Error('Folder limit');
		}
		const handle = await fs.opendir(directory);
		for await (const entry of handle) {
			checkCancellation();
			if (++entries > limits.entries) {
				throw new Error('Entry limit');
			}
			if (entry.isSymbolicLink()) {
				continue;
			}
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== '.git' && entry.name !== 'node_modules') {
					await visit(file, depth + 1);
				}
				continue;
			}
			if (!entry.isFile() || !/\.(html?|md|txt)$/i.test(entry.name)) {
				continue;
			}
			const relative = path.relative(root, file).split(path.sep).join('/');
			if (!safeRelativeFile(relative) || !isInsideRoot(await fs.realpath(file))) {
				throw new Error('Invalid document path');
			}
			const data = await readDocument(file, limits.bytes - bytes, documents.length >= limits.documents, checkCancellation);
			bytes += data.length;
			documents.push({ relative, bytes: data });
		}
	}

	await visit(root, 0);
	checkCancellation();
	return documents.sort((a, b) => a.relative.localeCompare(b.relative));
}
