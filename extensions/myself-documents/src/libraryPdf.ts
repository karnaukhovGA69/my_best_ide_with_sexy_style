/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { constants, type Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { maxDocumentBytes, readLocalBytes } from './libraryModel';

const pdfFolder = 'pdf-imports';
const pdfId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function pdfCopyFile(id: string): string | undefined {
	return pdfId.test(id) ? `${pdfFolder}/${id}.pdf` : undefined;
}

async function checkPdfFolder(folder: string): Promise<void> {
	if (!(await fs.lstat(folder)).isDirectory() || path.relative(folder, await fs.realpath(folder)) !== '') {
		throw new Error('Invalid PDF storage directory');
	}
}

async function storageRoot(storage: string): Promise<string> {
	if (!path.isAbsolute(storage) || !(await fs.lstat(storage)).isDirectory()) { throw new Error('Invalid library storage'); }
	return fs.realpath(storage);
}

export async function readSelectedPdf(file: string): Promise<Buffer> {
	const name = path.basename(file);
	if (!path.isAbsolute(file) || !/\.pdf$/i.test(name)) { throw new Error('PDF filename required'); }
	const bytes = await readLocalBytes(await fs.realpath(path.dirname(file)), name, maxDocumentBytes);
	if (!/^%PDF-\d\.\d(?:\r|\n)/.test(bytes.subarray(0, 10).toString('latin1'))) {
		throw new Error('PDF header required');
	}
	return bytes;
}

async function unlinkPdfCopy(target: string, expected?: Stats): Promise<void> {
	try {
		await checkPdfFolder(path.dirname(target));
		const current = await fs.lstat(target);
		if (!current.isFile() || (expected && (current.dev !== expected.dev || current.ino !== expected.ino))) {
			throw new Error('PDF copy changed');
		}
		await fs.unlink(target);
	} catch (error) {
		if (error.code !== 'ENOENT') { throw error; }
	}
}

/** Creates one exclusively owned copy. The returned rollback only removes that same file. */
export async function storePdfCopy(storage: string, file: string, bytes: Uint8Array, cancelled: () => boolean): Promise<() => Promise<void>> {
	if (pdfCopyFile(path.basename(file, '.pdf')) !== file) { throw new Error('Invalid PDF copy path'); }
	if (!path.isAbsolute(storage) || bytes.length > maxDocumentBytes) { throw new Error('Invalid PDF copy'); }
	const checkCancellation = () => { if (cancelled()) { throw new Error('Cancelled'); } };
	checkCancellation();
	await fs.mkdir(storage, { recursive: true, mode: 0o700 });
	const target = path.join(await storageRoot(storage), file);
	const folder = path.dirname(target);
	checkCancellation();
	await fs.mkdir(folder, { recursive: true, mode: 0o700 });
	await checkPdfFolder(folder);
	checkCancellation();
	const handle = await fs.open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
	let owned: Stats | undefined;
	try {
		try {
			const identity = await handle.stat();
			owned = identity;
			const checkCopy = async () => {
				await checkPdfFolder(folder);
				const current = await fs.lstat(target);
				if (!current.isFile() || current.dev !== identity.dev || current.ino !== identity.ino) { throw new Error('PDF copy changed'); }
			};
			await checkCopy();
			checkCancellation();
			await handle.writeFile(bytes);
			await checkCopy();
			checkCancellation();
			return () => unlinkPdfCopy(target, identity);
		} finally {
			await handle.close();
		}
	} catch (error) {
		if (owned) { await unlinkPdfCopy(target, owned).catch(() => {}); }
		throw error;
	}
}

export async function removePdfCopy(storage: string, file: string): Promise<void> {
	if (pdfCopyFile(path.basename(file, '.pdf')) !== file) { throw new Error('Invalid PDF copy path'); }
	try {
		await unlinkPdfCopy(path.join(await storageRoot(storage), file));
	} catch (error) {
		if (error.code !== 'ENOENT') { throw error; }
	}
}
