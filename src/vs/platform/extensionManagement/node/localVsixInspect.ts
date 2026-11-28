/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FileHandle } from 'fs/promises';
import { Readable } from 'stream';
import { crc32 } from 'zlib';
import type { Entry, ZipFile } from 'yauzl';
import { isValidBasename } from '../../../base/common/extpath.js';
import { parseTree, type Node, type ParseError } from '../../../base/common/json.js';
import { parse } from '../../../base/common/semver/semver.js';
import { isValidVersionStr } from '../../extensions/common/extensionValidator.js';
import { EXTENSION_IDENTIFIER_REGEX } from '../common/extensionManagement.js';
import { getGalleryExtensionId } from '../common/extensionManagementUtil.js';

const KiB = 1024;
const manifestEntry = 'extension/package.json';
const manifestLimit = 64 * KiB;
const entryLimit = 4096;
const expandedEntryLimit = 64 * 1024 * KiB;
const expandedArchiveLimit = 128 * 1024 * KiB;

export interface ILocalVsixMetadata {
	readonly id: string;
	readonly version: string;
	readonly engine: string;
}

async function* readRange(file: FileHandle, size: number, start: number, end: number, checkCancelled: () => void): AsyncIterable<Buffer> {
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > size) {
		throw new Error('ZIP read is outside the snapshot.');
	}
	for (let offset = start; offset < end;) {
		checkCancelled();
		const bytes = Buffer.allocUnsafe(Math.min(64 * KiB, end - offset));
		const { bytesRead } = await file.read(bytes, 0, bytes.length, offset);
		if (!bytesRead) {
			throw new Error('Unexpected end of the staged ZIP.');
		}
		offset += bytesRead;
		yield bytes.subarray(0, bytesRead);
	}
}

/** Inspect only the bounded ZIP directory and package.json, on the caller's open snapshot. */
export async function inspectStagedVsix(file: FileHandle, size: number, checkCancelled: () => void): Promise<ILocalVsixMetadata> {
	const { fromRandomAccessReader, RandomAccessReader } = await import('yauzl');
	checkCancelled();
	const reader = new class extends RandomAccessReader {
		override _readStreamForRange(start: number, end: number): Readable {
			return Readable.from(readRange(file, size, start, end, checkCancelled));
		}
	}();
	const zip = await new Promise<ZipFile>((resolve, reject) => {
		fromRandomAccessReader(reader, size, {
			lazyEntries: true,
			autoClose: false,
			strictFileNames: true,
			validateEntrySizes: true,
		}, (error, zip) => error ? reject(error) : resolve(zip));
	});
	const closed = new Promise<void>(resolve => zip.once('close', resolve));
	try {
		const entry = await findManifest(zip, checkCancelled);
		checkCancelled();
		const input = await new Promise<Readable>((resolve, reject) => {
			zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream));
		});
		const manifest = Buffer.alloc(entry.uncompressedSize);
		let offset = 0;
		let checksum = 0;
		for await (const chunk of input as AsyncIterable<Buffer>) {
			checkCancelled();
			if (chunk.length > manifest.length - offset) {
				throw new Error('The VSIX manifest exceeds its declared size.');
			}
			chunk.copy(manifest, offset);
			checksum = crc32(chunk, checksum);
			offset += chunk.length;
		}
		if (offset !== manifest.length || checksum !== entry.crc32) {
			throw new Error('The VSIX manifest size or checksum is inconsistent.');
		}
		checkCancelled();
		return parseMetadata(manifest);
	} finally {
		zip.close();
		await closed;
	}
}

function findManifest(zip: ZipFile, checkCancelled: () => void): Promise<Entry> {
	return new Promise((resolve, reject) => {
		if (zip.entryCount > entryLimit) {
			reject(new Error('The VSIX contains too many entries.'));
			return;
		}
		const paths = new Map<string, { name: string; directory: boolean; explicit: boolean }>();
		let manifest: Entry | undefined;
		let expandedBytes = 0;
		zip.on('error', reject);
		zip.once('end', () => manifest ? resolve(manifest) : reject(new Error('The VSIX manifest is missing.')));
		zip.on('entry', (entry: Entry) => {
			try {
				checkCancelled();
				const directory = entry.fileName.endsWith('/');
				const name = directory ? entry.fileName.slice(0, -1) : entry.fileName;
				const unixType = (entry.externalFileAttributes >>> 16) & 0o170000;
				const dosFlags = entry.externalFileAttributes & 0xffff;
				if ((unixType !== 0 && unixType !== (directory ? 0o040000 : 0o100000)) || (dosFlags & 0x0448)
					|| (!directory && (dosFlags & 0x10))
					|| (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
					|| (entry.generalPurposeBitFlag & ~(entry.compressionMethod === 8 ? 0x080e : 0x0808))
					|| !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0
					|| !Number.isSafeInteger(entry.relativeOffsetOfLocalHeader) || entry.relativeOffsetOfLocalHeader < 0
					|| entry.relativeOffsetOfLocalHeader + 30 + entry.compressedSize > zip.fileSize
					|| !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0
					|| entry.uncompressedSize > expandedEntryLimit || (expandedBytes += entry.uncompressedSize) > expandedArchiveLimit
					|| (directory && (entry.uncompressedSize !== 0 || entry.crc32 !== 0))) {
					throw new Error('The VSIX contains an unsupported entry or exceeds the archive limits.');
				}
				checkPath(paths, name, directory);
				if (name === manifestEntry) {
					if (directory || entry.uncompressedSize > manifestLimit || entry.compressedSize > manifestLimit + KiB) {
						throw new Error('The VSIX manifest exceeds the allowed size or has an unexpected type.');
					}
					manifest = entry;
				}
				zip.readEntry();
			} catch (error) {
				reject(error);
			}
		});
		zip.readEntry();
	});
}

function checkPath(paths: Map<string, { name: string; directory: boolean; explicit: boolean }>, name: string, directory: boolean): void {
	const segments = name.split('/');
	if (Buffer.byteLength(name) > 1024 || segments.length > 16
		|| segments.some(segment => !isValidBasename(segment, true) || Buffer.byteLength(segment) > 255 || /[\p{Cc}\p{Cf}\uFFFD]/u.test(segment))
		// The legacy extractor strips the extension prefix even for extension.vsixmanifest.
		|| name.toLowerCase() === 'extension/.vsixmanifest' || (directory && name === 'extension.vsixmanifest')
		|| (name.toLowerCase().startsWith('extension') && name !== 'extension.vsixmanifest'
			&& !name.startsWith('extension/') && !(directory && name === 'extension'))) {
		throw new Error('The VSIX contains an unsupported path.');
	}
	for (let count = 1; count <= segments.length; count++) {
		const path = segments.slice(0, count).join('/');
		const key = path.normalize('NFC').toUpperCase().toLowerCase().normalize('NFC');
		const explicit = count === segments.length;
		const isDirectory = !explicit || directory;
		const previous = paths.get(key);
		if (previous && (previous.name !== path || previous.directory !== isDirectory || (previous.explicit && explicit))) {
			throw new Error('The VSIX contains duplicate or conflicting paths.');
		}
		paths.set(key, { name: path, directory: isDirectory, explicit: explicit || !!previous?.explicit });
		if (paths.size > entryLimit) {
			throw new Error('The VSIX contains too many paths.');
		}
	}
}

function parseMetadata(bytes: Buffer): ILocalVsixMetadata {
	const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	const errors: ParseError[] = [];
	const root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
	if (!root || root.type !== 'object' || errors.length) {
		throw new Error('The VSIX manifest is invalid.');
	}
	const pending: Node[] = [root];
	while (pending.length) {
		const node = pending.pop()!;
		const keys = new Set<string>();
		for (const child of node.children ?? []) {
			if (node.type === 'object') {
				const key = child.children?.[0]?.value;
				if (typeof key !== 'string' || keys.has(key)) {
					throw new Error('The VSIX manifest contains duplicate JSON keys.');
				}
				keys.add(key);
			}
			pending.push(child);
		}
	}
	const manifest = JSON.parse(text);
	const { publisher, name, version } = manifest;
	const engine = manifest.engines?.vscode;
	const parsed = typeof version === 'string' && version.length <= 64 ? parse(version) : null;
	if (typeof publisher !== 'string' || typeof name !== 'string' || publisher.length + name.length > 127
		|| !EXTENSION_IDENTIFIER_REGEX.test(publisher + '.' + name)
		|| !parsed || version !== parsed.version + (parsed.build.length ? '+' + parsed.build.join('.') : '')
		|| typeof engine !== 'string' || engine.length > 128 || engine.trim() !== engine
		|| /[\p{Cc}\p{Cf}]/u.test(engine) || !isValidVersionStr(engine)) {
		throw new Error('The VSIX manifest has invalid extension metadata.');
	}
	return Object.freeze({ id: getGalleryExtensionId(publisher, name), version, engine });
}
