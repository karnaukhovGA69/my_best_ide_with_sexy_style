/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdtemp, open, readdir, readlink, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import pickle from 'chromium-pickle-js';

const execFileAsync = promisify(execFile);

interface IAsarIntegrity {
	algorithm: string;
	hash: string;
	blockSize: number;
	blocks: string[];
}

interface IAsarEntry {
	files?: Record<string, IAsarEntry>;
	unpacked?: boolean;
	size?: number;
	link?: string;
	integrity?: IAsarIntegrity;
}

async function fileIntegrity(filename: string, blockSize: number): Promise<IAsarIntegrity> {
	if (!Number.isSafeInteger(blockSize) || blockSize <= 0 || blockSize > 64 * 1024 * 1024) {
		throw new Error('Invalid ASAR integrity block size.');
	}
	const hash = createHash('sha256');
	const blocks: string[] = [];
	let pending = Buffer.alloc(0);
	for await (const chunk of createReadStream(filename)) {
		hash.update(chunk);
		pending = Buffer.concat([pending, chunk as Buffer]);
		while (pending.length >= blockSize) {
			blocks.push(createHash('sha256').update(pending.subarray(0, blockSize)).digest('hex'));
			pending = pending.subarray(blockSize);
		}
	}
	if (pending.length) {
		blocks.push(createHash('sha256').update(pending).digest('hex'));
	}
	return { algorithm: 'SHA256', hash: hash.digest('hex'), blockSize, blocks };
}

async function refreshAsarUnpackedMetadata(filename: string): Promise<boolean> {
	const handle = await open(filename, 'r');
	let headerSize: number;
	let header: IAsarEntry;
	try {
		const sizeBuffer = Buffer.alloc(8);
		await handle.read(sizeBuffer, 0, sizeBuffer.length, 0);
		headerSize = pickle.createFromBuffer(sizeBuffer).createIterator().readUInt32();
		if (headerSize < 8 || headerSize > (await handle.stat()).size - 8) {
			throw new Error('Invalid ASAR header size.');
		}
		const headerBuffer = Buffer.alloc(headerSize);
		await handle.read(headerBuffer, 0, headerBuffer.length, 8);
		header = JSON.parse(pickle.createFromBuffer(headerBuffer).createIterator().readString());
	} finally {
		await handle.close();
	}
	let changed = false;
	const unpackedRoot = `${filename}.unpacked`;
	const refresh = async (entry: IAsarEntry, relative = '', parentUnpacked = false): Promise<void> => {
		const unpacked = parentUnpacked || entry.unpacked;
		if (entry.files) {
			for (const [name, child] of Object.entries(entry.files)) {
				if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
					throw new Error('Invalid ASAR entry name.');
				}
				await refresh(child, path.join(relative, name), unpacked);
			}
		} else if (unpacked && !entry.link) {
			const unpackedFile = path.join(unpackedRoot, relative);
			const stat = await lstat(unpackedFile);
			if (!stat.isFile()) {
				throw new Error('ASAR unpacked entry must be a regular file.');
			}
			if (entry.size !== stat.size) {
				entry.size = stat.size;
				changed = true;
			}
			if (entry.integrity) {
				if (entry.integrity.algorithm !== 'SHA256') {
					throw new Error('Unsupported ASAR integrity algorithm.');
				}
				const integrity = await fileIntegrity(unpackedFile, entry.integrity.blockSize);
				if (JSON.stringify(entry.integrity) !== JSON.stringify(integrity)) {
					entry.integrity = integrity;
					changed = true;
				}
			}
		}
	};
	await refresh(header);
	if (!changed) {
		return false;
	}
	// Packed offsets are relative to the payload, so its bytes can be copied unchanged.
	// Encode the header with the same Pickle implementation as createAsar().
	const headerPickle = pickle.createEmpty();
	headerPickle.writeString(JSON.stringify(header));
	const headerBuffer = headerPickle.toBuffer();
	const sizePickle = pickle.createEmpty();
	sizePickle.writeUInt32(headerBuffer.length);
	const temporaryDirectory = await mkdtemp(path.join(path.dirname(filename), '.asar-privacy-'));
	try {
		const temporaryFile = path.join(temporaryDirectory, 'archive');
		await writeFile(temporaryFile, Buffer.concat([sizePickle.toBuffer(), headerBuffer]), { mode: (await lstat(filename)).mode });
		await pipeline(createReadStream(filename, { start: 8 + headerSize }), createWriteStream(temporaryFile, { flags: 'a' }));
		await rename(temporaryFile, filename);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
	return true;
}

/** Run after native stripping/signing, then sign the outer app without --deep. */
export async function refreshDarwinAsarMetadata(directory: string): Promise<number> {
	let updated = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			updated += await refreshDarwinAsarMetadata(filename);
		} else if (entry.isFile() && entry.name.endsWith('.asar') && await refreshAsarUnpackedMetadata(filename)) {
			updated++;
		}
	}
	return updated;
}

function buildPathPatterns(forbiddenPaths: readonly string[]): Buffer[] {
	const variants = new Set<string>();
	for (const value of forbiddenPaths) {
		if (!path.isAbsolute(value) || value === path.parse(value).root) {
			throw new Error('Distribution privacy checks require non-root absolute build paths.');
		}
		variants.add(value);
		variants.add(value.replaceAll('\\', '/'));
		variants.add(JSON.stringify(value).slice(1, -1));
	}
	return Array.from(variants).flatMap(value => {
		const utf16 = Buffer.from(value, 'utf16le');
		return [Buffer.from(value), utf16, Buffer.from(utf16).swap16()];
	});
}

async function containsBuildPath(filename: string, patterns: readonly Buffer[]): Promise<boolean> {
	const overlap = Math.max(0, ...patterns.map(pattern => pattern.length - 1));
	let previous = Buffer.alloc(0);
	for await (const chunk of createReadStream(filename)) {
		const contents = Buffer.concat([previous, chunk as Buffer]);
		if (patterns.some(pattern => contents.includes(pattern))) {
			return true;
		}
		previous = contents.subarray(Math.max(0, contents.length - overlap));
	}
	return false;
}

async function findBuildPathFiles(directory: string, patterns: readonly Buffer[]): Promise<string[]> {
	const matches: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name);
		if (entry.isSymbolicLink()) {
			const target = Buffer.from(await readlink(filename));
			if (patterns.some(pattern => target.includes(pattern))) {
				matches.push(filename);
			}
		} else if (entry.isDirectory()) {
			matches.push(...await findBuildPathFiles(filename, patterns));
		} else if (entry.isFile() && await containsBuildPath(filename, patterns)) {
			matches.push(filename);
		}
	}
	return matches;
}

async function isMachO(filename: string): Promise<boolean> {
	if (!(await lstat(filename)).isFile()) {
		return false;
	}
	const handle = await open(filename, 'r');
	try {
		const header = Buffer.alloc(8);
		const { bytesRead } = await handle.read(header, 0, header.length, 0);
		if (bytesRead < 8) {
			return false;
		}
		const magic = header.readUInt32BE(0);
		return [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(magic)
			|| ([0xcafebabe, 0xcafebabf].includes(magic) && header.readUInt32BE(4) <= 16);
	} finally {
		await handle.close();
	}
}

/** Checks the unpacked distribution, including ASAR bytes, without printing private paths. */
export async function assertNoBuildPaths(directory: string, forbiddenPaths: readonly string[]): Promise<void> {
	const matches = await findBuildPathFiles(directory, buildPathPatterns(forbiddenPaths));
	if (matches.length) {
		throw new Error(`Distribution contains private build paths in: ${matches.map(filename => path.relative(directory, filename)).join(', ')}`);
	}
}

/** Removes Mach-O debug maps with Apple's linker tools. Run before code signing. */
export async function sanitizeDarwinDistribution(directory: string, forbiddenPaths: readonly string[]): Promise<number> {
	if (process.platform !== 'darwin') {
		throw new Error('Sanitizing a macOS distribution requires the macOS developer tools.');
	}
	const matches = await findBuildPathFiles(directory, buildPathPatterns(forbiddenPaths));
	let stripped = 0;
	for (const filename of matches) {
		// Only native debug metadata is removed. Source text, runtime literals and other
		// leaks must be fixed at their source; the final validation rejects them.
		if (await isMachO(filename)) {
			try {
				await execFileAsync('xcrun', ['strip', '-S', filename]);
			} catch {
				throw new Error(`Could not remove native debug symbols from ${path.relative(directory, filename)}.`);
			}
			stripped++;
		}
	}
	await refreshDarwinAsarMetadata(directory);
	await assertNoBuildPaths(directory, forbiddenPaths);
	return stripped;
}
