/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createWriteStream, constants } from 'node:fs';
import { mkdir, open, type FileHandle } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { type Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { crc32 } from 'node:zlib';
import * as yauzl from 'yauzl';

const MiB = 1024 * 1024;
const zipLimit = 128 * MiB;
const totalLimit = 512 * MiB;
const fileLimit = 256 * MiB;
const entryLimit = 4096;
const depthLimit = 16;
const dataDescriptorFlag = 1 << 3;
const dataDescriptorSignature = 0x08074b50;
// Timestamps and Unix UID/GID. Extraction does not apply any extra fields.
const extraFields = new Set([0x5455, 0x7875, 0x000a]);
const forbiddenName = /[<>:"\\|?*\p{Cc}\p{Cf}\uFFFD]|[ .]$/u;
const deviceName = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

interface LocalHeader {
	fileDataStart: number;
	fileName: Buffer;
	extraField: Buffer;
	generalPurposeBitFlag: number;
	compressionMethod: number;
	crc32: number;
	compressedSize: number;
	uncompressedSize: number;
}

// These fields are public in yauzl 3.3.1, and absent from the repository's older @types/yauzl.
type ZipFile = Omit<yauzl.ZipFile, 'readEntryCursor'> & {
	readEntryCursor: number;
	readLocalFileHeader(entry: yauzl.Entry, callback: (error: Error | null, header: LocalHeader) => void): void;
};
type ZipEntry = yauzl.Entry & { fileNameRaw: Buffer };

interface ArchiveEntry {
	entry: ZipEntry;
	path: string;
	directory: boolean;
	start: number;
	end: number;
}

interface StagedArchive {
	files: string[];
	treeSha256: string;
}

export function isPortableArchivePath(relative: string): boolean {
	const segments = relative.split('/');
	return Buffer.byteLength(relative) <= 1024 && segments.length <= depthLimit
		&& segments.every(segment => !!segment && Buffer.byteLength(segment) <= 255
			&& !forbiddenName.test(segment) && !deviceName.test(segment));
}

export async function snapshotZip(source: string, destination: string, signal?: AbortSignal): Promise<string> {
	signal?.throwIfAborted();
	const file = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const initial = await file.stat({ bigint: true });
		if (!initial.isFile() || initial.size < 22 || initial.size > BigInt(zipLimit)) {
			throw new Error('Select a regular ZIP within the 128 MiB limit.');
		}
		const hash = createHash('sha256');
		let bytes = 0;
		await pipeline(file.createReadStream({ autoClose: false }), new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				bytes += chunk.length;
				if (bytes > zipLimit || bytes > Number(initial.size)) {
					callback(new Error('ZIP changed during import.'));
					return;
				}
				hash.update(chunk);
				callback(null, chunk);
			},
		}), createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal });
		const final = await file.stat({ bigint: true });
		if (BigInt(bytes) !== initial.size || initial.size !== final.size || initial.mtimeNs !== final.mtimeNs || initial.ctimeNs !== final.ctimeNs) {
			throw new Error('ZIP changed during import.');
		}
		return hash.digest('hex');
	} finally {
		await file.close();
	}
}

function readEntries(zip: ZipFile, signal?: AbortSignal): Promise<ZipEntry[]> {
	if (zip.entryCount < 1 || zip.entryCount > entryLimit) {
		throw new Error('Unsupported number of ZIP entries.');
	}
	return new Promise((resolve, reject) => {
		const entries: ZipEntry[] = [];
		zip.once('error', reject);
		zip.once('end', () => resolve(entries));
		zip.on('entry', (entry: ZipEntry) => {
			if (signal?.aborted) {
				reject(signal.reason);
				return;
			}
			if (entry.fileNameLength > 1024 || entry.extraFieldLength > 1024 || entry.fileCommentLength > 1024) {
				reject(new Error('ZIP entry metadata exceeds its size limit.'));
				return;
			}
			entries.push(entry);
			zip.readEntry();
		});
		zip.readEntry();
	});
}

function validateExtraFields(fields: Buffer): void {
	for (let offset = 0; offset < fields.length;) {
		if (fields.length - offset < 4 || !extraFields.has(fields.readUInt16LE(offset))) {
			throw new Error('Unsupported ZIP extra field.');
		}
		offset += 4 + fields.readUInt16LE(offset + 2);
		if (offset > fields.length) {
			throw new Error('Truncated ZIP extra field.');
		}
	}
}

function validateLocalHeader(zip: ZipFile, entry: ZipEntry): Promise<number> {
	return new Promise((resolve, reject) => {
		zip.readLocalFileHeader(entry, (error, header) => {
			if (error) {
				reject(error);
				return;
			}
			const hasDescriptor = (entry.generalPurposeBitFlag & dataDescriptorFlag) !== 0;
			if (!header.fileName.equals(entry.fileNameRaw) || header.compressionMethod !== entry.compressionMethod
				|| header.generalPurposeBitFlag !== entry.generalPurposeBitFlag
				|| !(header.crc32 === entry.crc32 || (hasDescriptor && header.crc32 === 0))
				|| !(header.compressedSize === entry.compressedSize || (hasDescriptor && header.compressedSize === 0))
				|| !(header.uncompressedSize === entry.uncompressedSize || (hasDescriptor && header.uncompressedSize === 0))) {
				reject(new Error('ZIP local header does not match its central directory.'));
				return;
			}
			try {
				validateExtraFields(header.extraField);
				resolve(header.fileDataStart);
			} catch (validationError) {
				reject(validationError);
			}
		});
	});
}

async function validateDataDescriptor(snapshot: FileHandle, entry: ZipEntry, start: number, limit: number): Promise<void> {
	// ZIP32 has three four-byte fields and an optional four-byte signature.
	const available = Math.min(16, limit - start);
	const descriptor = available >= 12 ? await readHeader(snapshot, start, available) : undefined;
	if (!descriptor) {
		throw new Error('ZIP data descriptor is missing or truncated.');
	}
	const matches = (offset: number) => descriptor.readUInt32LE(offset) === entry.crc32
		&& descriptor.readUInt32LE(offset + 4) === entry.compressedSize
		&& descriptor.readUInt32LE(offset + 8) === entry.uncompressedSize;
	// A descriptor without a signature can happen to start with the same CRC value.
	if (matches(0) || (descriptor.length === 16 && descriptor.readUInt32LE(0) === dataDescriptorSignature && matches(4))) {
		return;
	}
	throw new Error('ZIP data descriptor does not match its central directory.');
}

function registerPath(nodes: Map<string, { path: string; directory: boolean; explicit: boolean }>, relative: string, directory: boolean): void {
	const parts = relative.split('/');
	for (let index = 0; index < parts.length; index++) {
		const name = parts.slice(0, index + 1).join('/');
		const key = name.normalize('NFC').toUpperCase().toLowerCase().normalize('NFC');
		const explicit = index === parts.length - 1;
		const isDirectory = !explicit || directory;
		const previous = nodes.get(key);
		if (previous && (previous.path !== name || previous.directory !== isDirectory || (previous.explicit && explicit))) {
			throw new Error('Duplicate or conflicting ZIP path.');
		}
		nodes.set(key, { path: name, directory: isDirectory, explicit: explicit || !!previous?.explicit });
		if (nodes.size > entryLimit) {
			throw new Error('ZIP contains too many paths.');
		}
	}
}

async function inspectZip(zip: ZipFile, snapshot: FileHandle, signal?: AbortSignal): Promise<ArchiveEntry[]> {
	const centralDirectoryStart = zip.readEntryCursor;
	const entries = await readEntries(zip, signal);
	const nodes = new Map<string, { path: string; directory: boolean; explicit: boolean }>();
	const checked: ArchiveEntry[] = [];
	let total = 0;
	for (const entry of entries) {
		signal?.throwIfAborted();
		const directory = entry.fileName.endsWith('/');
		const relative = directory ? entry.fileName.slice(0, -1) : entry.fileName;
		const mode = entry.externalFileAttributes >>> 16;
		const kind = mode & 0o170000;
		const dos = entry.externalFileAttributes & 0xffff;
		// Bits 1/2 are deflate options; bit 3 indicates a data descriptor; bit 11 means UTF-8.
		const supportedFlags = entry.compressionMethod === 8 ? 0x080e : 0x0808;
		if (!isPortableArchivePath(relative) || (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
			|| (entry.generalPurposeBitFlag & ~supportedFlags) || (dos & 0x0448)
			|| ((dos & 0x10) && !directory) || (kind !== 0 && kind !== (directory ? 0o040000 : 0o100000))
			|| (directory && (entry.uncompressedSize !== 0 || entry.crc32 !== 0))
			|| entry.uncompressedSize > fileLimit || (total += entry.uncompressedSize) > totalLimit
			|| entry.extraFields.some(field => !extraFields.has(field.id))) {
			throw new Error('Unsupported ZIP entry, path, or size.');
		}
		registerPath(nodes, relative, directory);
		const dataStart = await validateLocalHeader(zip, entry);
		const dataEnd = dataStart + entry.compressedSize;
		if (dataEnd > centralDirectoryStart) {
			throw new Error('ZIP entry overlaps its central directory.');
		}
		checked.push({ entry, path: relative, directory, start: entry.relativeOffsetOfLocalHeader, end: dataEnd });
	}

	checked.sort((a, b) => a.start - b.start);
	for (let index = 0; index < checked.length; index++) {
		signal?.throwIfAborted();
		const { entry, end } = checked[index];
		const nextHeader = checked[index + 1]?.start ?? centralDirectoryStart;
		if (end > nextHeader) {
			throw new Error('Overlapping ZIP entries.');
		}
		if (entry.generalPurposeBitFlag & dataDescriptorFlag) {
			// Limit the complete entry, including its descriptor, to the bytes
			// before the next header.
			await validateDataDescriptor(snapshot, entry, end, nextHeader);
		}
	}
	return checked;
}

function entryStream(zip: ZipFile, entry: ZipEntry): Promise<Readable> {
	return new Promise((resolve, reject) => {
		zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream));
	});
}

export async function extractZip(snapshot: string, destination: string, signal?: AbortSignal): Promise<StagedArchive> {
	const zip = await new Promise<ZipFile>((resolve, reject) => {
		yauzl.open(snapshot, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true },
			(error, zip) => error ? reject(error) : resolve(zip as unknown as ZipFile));
	});
	// Install the close listener before starting to read. Errors, including late close
	// errors, always have a listener while yauzl owns the file descriptor.
	const closed = new Promise<Error | undefined>(resolve => {
		zip.once('close', () => resolve(undefined));
		zip.on('error', error => {
			// An entry error still leaves the descriptor open until close().
			if (!zip.isOpen) {
				resolve(error);
			}
		});
	});
	let result: StagedArchive;
	try {
		const handle = await open(snapshot, constants.O_RDONLY | constants.O_NOFOLLOW);
		let entries: ArchiveEntry[];
		try {
			entries = await inspectZip(zip, handle, signal);
		} finally {
			await handle.close();
		}
		const digestEntries: [string, number, string][] = [];
		let total = 0;
		for (const { entry, path: relative, directory } of entries) {
			signal?.throwIfAborted();
			const segments = relative.split('/');
			const parent = join(destination, ...segments.slice(0, -1));
			await mkdir(parent, { recursive: true, mode: 0o700 });
			const target = join(parent, segments[segments.length - 1]);
			let bytes = 0;
			let checksum = 0;
			const hash = createHash('sha256');
			const stream = await entryStream(zip, entry);
			const validate = new Transform({
				transform(chunk: Buffer, _encoding, callback) {
					bytes += chunk.length;
					total += chunk.length;
					if (bytes > entry.uncompressedSize || total > totalLimit) {
						callback(new Error('ZIP extraction limit exceeded.'));
						return;
					}
					checksum = crc32(chunk, checksum);
					hash.update(chunk);
					callback(null, chunk);
				},
			});
			if (directory) {
				await pipeline(stream, validate, new Writable({ write(_chunk, _encoding, done) { done(); } }), { signal });
				await mkdir(target, { recursive: true, mode: 0o700 });
			} else {
				await pipeline(stream, validate, createWriteStream(target, { flags: 'wx', mode: 0o600 }), { signal });
			}
			if (bytes !== entry.uncompressedSize || checksum !== entry.crc32) {
				throw new Error('ZIP entry size or checksum does not match.');
			}
			if (!directory) {
				digestEntries.push([relative, bytes, hash.digest('hex')]);
			}
		}
		digestEntries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
		result = {
			files: digestEntries.map(([file]) => file),
			treeSha256: createHash('sha256').update(JSON.stringify(digestEntries)).digest('hex'),
		};
	} finally {
		zip.close();
		await closed;
	}
	const closeError = await closed;
	if (closeError) {
		throw closeError;
	}
	return result;
}

const cpuArm64 = 0x0100000c;
const mhExecute = 2;

async function readHeader(handle: FileHandle, offset: number, length: number): Promise<Buffer | undefined> {
	const result = Buffer.alloc(length);
	let read = 0;
	while (read < length) {
		const { bytesRead } = await handle.read(result, read, length - read, offset + read);
		if (bytesRead === 0) {
			return undefined;
		}
		read += bytesRead;
	}
	return result;
}

async function isArm64ExecutableSlice(handle: FileHandle, offset: number, sliceSize: number, header?: Buffer): Promise<boolean> {
	header ??= await readHeader(handle, offset, 32);
	if (!header || header.readUInt32LE(0) !== 0xfeedfacf || header.readUInt32LE(4) !== cpuArm64 || header.readUInt32LE(12) !== mhExecute) {
		return false;
	}
	const commands = header.readUInt32LE(16);
	const commandBytes = header.readUInt32LE(20);
	if (commands === 0 || commandBytes < commands * 8 || commandBytes > MiB || commandBytes > sliceSize - header.length) {
		return false;
	}
	const table = await readHeader(handle, offset + header.length, commandBytes);
	if (!table) {
		return false;
	}
	let position = 0;
	let hasEntry = false;
	for (let index = 0; index < commands; index++) {
		if (position + 8 > table.length) {
			return false;
		}
		const command = table.readUInt32LE(position);
		const size = table.readUInt32LE(position + 4);
		if (size < 8 || size % 8 !== 0 || size > table.length - position) {
			return false;
		}
		// LC_MAIN or LC_UNIXTHREAD declares how the loader enters the executable.
		hasEntry ||= (command === 0x80000028 && size === 24) || (command === 5 && size >= 16);
		position += size;
	}
	return hasEntry && position === table.length;
}

/** Checks format and architecture only. This does not authenticate or execute the file. */
export async function isMacArm64Executable(path: string): Promise<boolean> {
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const stat = await handle.stat();
		if (!stat.isFile()) {
			return false;
		}
		const header = await readHeader(handle, 0, 32);
		if (!header) {
			return false;
		}
		const magic = header.readUInt32BE(0);
		if (magic !== 0xcafebabe && magic !== 0xcafebabf) {
			return await isArm64ExecutableSlice(handle, 0, stat.size, header);
		}
		const fat64 = magic === 0xcafebabf;
		const entrySize = fat64 ? 32 : 20;
		const entries = header.readUInt32BE(4);
		if (entries < 1 || entries > 32) {
			return false;
		}
		const table = await readHeader(handle, 8, entries * entrySize);
		if (!table) {
			return false;
		}
		for (let index = 0; index < entries; index++) {
			const base = index * entrySize;
			if (table.readUInt32BE(base) !== cpuArm64) {
				continue;
			}
			const offset = fat64 ? Number(table.readBigUInt64BE(base + 8)) : table.readUInt32BE(base + 8);
			const size = fat64 ? Number(table.readBigUInt64BE(base + 16)) : table.readUInt32BE(base + 12);
			if (offset >= 8 + table.length && size >= 32 && offset + size <= stat.size
				&& await isArm64ExecutableSlice(handle, offset, size)) {
				return true;
			}
		}
		return false;
	} finally {
		await handle.close();
	}
}
