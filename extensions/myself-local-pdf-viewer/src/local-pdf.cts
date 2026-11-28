/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { constants, type BigIntStats } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { types } from 'node:util';
import type { Uri } from 'vscode';

export const maxPdfBytes = 16 * 1024 * 1024;
const pdfHeader = Buffer.from('%PDF-');
const typedArrayPrototype: object = Object.getPrototypeOf(Uint8Array.prototype);
const viewByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const viewBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;

export type LocalPdfUri = Pick<Uri, 'scheme' | 'authority' | 'fsPath' | 'path' | 'query' | 'fragment'>;
export type PdfInputFailure = 'local' | 'size' | 'changed' | 'format';

export class PdfInputError extends Error {
	constructor(readonly reason: PdfInputFailure) {
		super(reason);
	}
}

function hasPdfHeader(bytes: ArrayBuffer): boolean {
	return bytes.byteLength >= pdfHeader.length && Buffer.from(bytes, 0, pdfHeader.length).equals(pdfHeader);
}

/** Copy the supplied view before yielding to the caller. Check the header of the owned copy. */
export function copyPdfBytes(input: unknown): ArrayBuffer | undefined {
	if (!types.isUint8Array(input)) {
		return undefined;
	}
	// Read the real view, including for Buffer slices and subclasses with overridden accessors.
	const size: number = viewByteLength.call(input);
	if (size < pdfHeader.length || size > maxPdfBytes || types.isSharedArrayBuffer(viewBuffer.call(input))) {
		return undefined;
	}
	const copy = new Uint8Array(size);
	copy.set(input);
	return hasPdfHeader(copy.buffer) ? copy.buffer : undefined;
}

function sameFile(before: BigIntStats, after: BigIntStats) {
	return before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
		before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

/** Read only the file just chosen in the native picker, using a bounded descriptor read. */
export async function readLocalPdf(uri: LocalPdfUri): Promise<ArrayBuffer> {
	if (uri?.scheme !== 'file' || uri.authority || !path.isAbsolute(uri.fsPath) ||
		path.extname(uri.fsPath).toLowerCase() !== '.pdf' || uri.query || uri.fragment ||
		uri.path.startsWith('//') || /^[/\\]{2}/.test(uri.fsPath)) {
		throw new PdfInputError('local');
	}

	const chosen = await fs.lstat(uri.fsPath, { bigint: true });
	if (!chosen.isFile()) {
		throw new PdfInputError('local');
	}
	const canonicalPath = await fs.realpath(uri.fsPath);
	if (canonicalPath.startsWith('\\\\') || canonicalPath.startsWith('//')) {
		throw new PdfInputError('local');
	}
	const canonical = await fs.lstat(canonicalPath, { bigint: true });
	if (!canonical.isFile() || !sameFile(chosen, canonical)) {
		throw new PdfInputError('local');
	}
	if (chosen.size > maxPdfBytes) {
		throw new PdfInputError('size');
	}

	const file = await fs.open(canonicalPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
	try {
		const opened = await file.stat({ bigint: true });
		if (!opened.isFile() || !sameFile(chosen, opened)) {
			throw new PdfInputError('changed');
		}
		const buffer = new ArrayBuffer(Number(opened.size));
		const bytes = new Uint8Array(buffer);
		let offset = 0;
		while (offset < bytes.byteLength) {
			const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
			if (bytesRead === 0) {
				throw new PdfInputError('changed');
			}
			offset += bytesRead;
		}
		if (!sameFile(opened, await file.stat({ bigint: true })) ||
			!sameFile(opened, await fs.lstat(canonicalPath, { bigint: true }))) {
			throw new PdfInputError('changed');
		}
		if (!hasPdfHeader(buffer)) {
			throw new PdfInputError('format');
		}
		return buffer;
	} finally {
		await file.close();
	}
}
