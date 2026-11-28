/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const maxPdfBytes = 16 * 1024 * 1024;
const pdfHeader = Buffer.from('%PDF-');

class PdfInputError extends Error {
	constructor(reason) {
		super(reason);
		this.reason = reason;
	}
}

function sameFile(before, after) {
	return before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
		before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

/** Read only the file just chosen in the native picker, using a bounded descriptor read. */
async function readLocalPdf(uri) {
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
		if (buffer.byteLength < pdfHeader.length || !Buffer.from(buffer, 0, pdfHeader.length).equals(pdfHeader)) {
			throw new PdfInputError('format');
		}
		return buffer;
	} finally {
		await file.close();
	}
}

module.exports = { maxPdfBytes, PdfInputError, readLocalPdf };
