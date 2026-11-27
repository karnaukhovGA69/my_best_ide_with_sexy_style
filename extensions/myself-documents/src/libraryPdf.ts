/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createHash } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { maxDocumentBytes, readLocalBytes, readLocalSnapshot } from './libraryModel';

const pdfFolder = 'pdf-imports';
const pdfId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function pdfCopyFile(id: string): string | undefined {
	return pdfId.test(id) ? `${pdfFolder}/${id}.pdf` : undefined;
}

export function pdfCopyDigest(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function isPdfCopyDigest(value: unknown): value is string {
	return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
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

type CopyIdentity = Pick<Stats, 'dev' | 'ino'> & Partial<Pick<Stats, 'size' | 'mtimeMs' | 'ctimeMs'>>;

async function unlinkPdfCopy(target: string, expected: CopyIdentity): Promise<void> {
	try {
		await checkPdfFolder(path.dirname(target));
		const current = await fs.lstat(target);
		if (!current.isFile() || current.dev !== expected.dev || current.ino !== expected.ino
			|| (expected.size !== undefined && current.size !== expected.size)
			|| (expected.mtimeMs !== undefined && current.mtimeMs !== expected.mtimeMs)
			|| (expected.ctimeMs !== undefined && current.ctimeMs !== expected.ctimeMs)) {
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
	let owned: CopyIdentity | undefined;
	try {
		try {
			const { dev, ino } = await handle.stat();
			const identity = { dev, ino };
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

export async function removePdfCopy(storage: string, file: string, digest: string | undefined): Promise<void> {
	if (pdfCopyFile(path.basename(file, '.pdf')) !== file || !isPdfCopyDigest(digest)) { throw new Error('Invalid PDF copy record'); }
	try {
		const root = await storageRoot(storage);
		const { bytes, stat } = await readLocalSnapshot(root, file, maxDocumentBytes);
		if (pdfCopyDigest(bytes) !== digest) { throw new Error('PDF copy changed'); }
		await unlinkPdfCopy(path.join(root, file), stat);
	} catch (error) {
		if (error.code !== 'ENOENT') { throw error; }
	}
}
