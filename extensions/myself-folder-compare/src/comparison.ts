/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs';
import * as path from 'node:path';

export const defaultLimits = Object.freeze({ entries: 4000, depth: 8, fileBytes: 4 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, durationMs: 20000 });
export type ScanReason = 'link' | 'special' | 'unreadable' | 'notLocal' | 'notDirectory' | 'unstable' | 'entries' | 'depth' | 'fileBytes' | 'totalBytes' | 'time' | 'unsupported' | 'type' | 'directory';

export interface ComparisonEntry {
	path: string;
	status: 'added' | 'removed' | 'changed' | 'skipped';
	reason?: ScanReason;
	code?: string;
	original?: Buffer;
	modified?: Buffer;
}

export interface ComparisonResult {
	entries: ComparisonEntry[];
	examined: number;
	bytesRead: number;
	incomplete: boolean;
	cancelled: boolean;
}

interface ComparisonOptions {
	io?: Pick<typeof fs.promises, 'lstat' | 'realpath' | 'opendir' | 'open'>;
	limits?: Partial<typeof defaultLimits>;
	cancelled?: () => boolean;
	now?: () => number;
}

interface Root {
	path: string;
	stat: fs.BigIntStats;
}

class ScanProblem extends Error {
	constructor(readonly reason: ScanReason, readonly code?: string) {
		super(reason);
	}
}

class Cancelled extends Error { }

function sameIdentity(a: fs.BigIntStats, b: fs.BigIntStats): boolean {
	return a.dev === b.dev && a.ino === b.ino;
}

function sameVersion(a: fs.BigIntStats, b: fs.BigIntStats): boolean {
	return sameIdentity(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}

function samePath(a: string, b: string): boolean {
	return path.relative(a, b) === '';
}

/** Compare only explicitly selected native paths. No providers, watchers, processes or writes. */
export async function compareFolders(leftPath: string, rightPath: string, options: ComparisonOptions = {}): Promise<ComparisonResult> {
	const io = options.io ?? fs.promises;
	const limits = { ...defaultLimits, ...options.limits };
	for (const [key, value] of Object.entries(limits)) {
		if (!Object.hasOwn(defaultLimits, key) || !Number.isSafeInteger(value) || value < 1 || value > defaultLimits[key as keyof typeof defaultLimits]) {
			throw new RangeError('Invalid comparison limit');
		}
	}
	const result: ComparisonResult = { entries: [], examined: 0, bytesRead: 0, incomplete: false, cancelled: false };
	const now = options.now ?? Date.now;
	const deadline = now() + limits.durationMs;
	const checkCancelled = () => {
		if (options.cancelled?.()) {
			throw new Cancelled();
		}
		if (now() > deadline) {
			throw new ScanProblem('time');
		}
	};
	const read = async <T>(operation: () => Promise<T>): Promise<T> => {
		checkCancelled();
		const value = await operation();
		checkCancelled();
		return value;
	};
	const skipped = (relativePath: string, error: unknown) => {
		result.incomplete = true;
		const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
		result.entries.push({ path: relativePath || '.', status: 'skipped', reason: error instanceof ScanProblem ? error.reason : 'unreadable', code: typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : undefined });
	};
	const stat = (file: string) => read(() => io.lstat(file, { bigint: true }));
	const inspect = async (file: string) => {
		const value = await stat(file);
		if (value.isSymbolicLink()) {
			throw new ScanProblem('link');
		}
		if (!value.isDirectory() && !value.isFile()) {
			throw new ScanProblem('special');
		}
		return value;
	};
	const root = async (selected: string): Promise<Root> => {
		if (typeof selected !== 'string' || !path.isAbsolute(selected) || /^[\\/]{2}/.test(selected) || selected.includes('\0')) {
			throw new ScanProblem('notLocal');
		}
		const absolute = path.resolve(selected);
		let component = path.parse(absolute).root;
		for (const name of path.relative(component, absolute).split(path.sep).filter(Boolean)) {
			component = path.join(component, name);
			const value = await inspect(component);
			if (!value.isDirectory()) {
				throw new ScanProblem('notDirectory');
			}
		}
		const value = await inspect(absolute);
		if (!value.isDirectory()) {
			throw new ScanProblem('notDirectory');
		}
		const real = await read(() => io.realpath(absolute));
		if (!samePath(absolute, real)) {
			throw new ScanProblem('link');
		}
		return { path: absolute, stat: value };
	};
	const guard = async (base: Root, relativePath: string): Promise<Root> => {
		const parts = relativePath ? relativePath.split('/') : [];
		if (parts.some(name => !name || name === '.' || name === '..' || name.includes(path.sep))) {
			throw new ScanProblem('notLocal');
		}
		let target = base.path;
		let value = await inspect(target);
		if (!value.isDirectory() || !sameIdentity(value, base.stat)) {
			throw new ScanProblem('unstable');
		}
		for (const [index, name] of parts.entries()) {
			target = path.join(target, name);
			value = await inspect(target);
			if (index < parts.length - 1 && !value.isDirectory()) {
				throw new ScanProblem('unstable');
			}
		}
		const real = await read(() => io.realpath(target));
		if (!samePath(target, real)) {
			throw new ScanProblem('link');
		}
		return { path: target, stat: value };
	};
	const directory = async (base: Root, relativePath: string) => {
		const before = await guard(base, relativePath);
		if (!before.stat.isDirectory()) {
			throw new ScanProblem('unstable');
		}
		checkCancelled();
		const handle = await io.opendir(before.path, { bufferSize: 1 });
		try {
			checkCancelled();
			if (!sameVersion(before.stat, (await guard(base, relativePath)).stat)) {
				throw new ScanProblem('unstable');
			}
			const names = new Set<string>();
			while (true) {
				if (result.examined >= limits.entries) {
					throw new ScanProblem('entries');
				}
				const entry = await read(() => handle.read());
				if (!entry) {
					break;
				}
				result.examined++;
				if (entry.name === '.' || entry.name === '..' || path.basename(entry.name) !== entry.name || entry.name.includes('/')) {
					throw new ScanProblem('unstable');
				}
				names.add(entry.name);
			}
			if (!sameVersion(before.stat, (await guard(base, relativePath)).stat)) {
				throw new ScanProblem('unstable');
			}
			return names;
		} finally {
			await handle.close();
		}
	};
	const file = async (base: Root, relativePath: string, expected: fs.BigIntStats) => {
		const before = await guard(base, relativePath);
		if (!before.stat.isFile() || !sameVersion(before.stat, expected)) {
			throw new ScanProblem('unstable');
		}
		// Reserve one byte for an EOF probe; metadata is not evidence of complete content.
		if (before.stat.size >= BigInt(limits.fileBytes)) {
			throw new ScanProblem('fileBytes');
		}
		if (before.stat.size >= BigInt(limits.totalBytes - result.bytesRead)) {
			throw new ScanProblem('totalBytes');
		}
		checkCancelled();
		const handle = await io.open(before.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
		try {
			checkCancelled();
			const opened = await read(() => handle.stat({ bigint: true }));
			if (!opened.isFile() || !sameVersion(opened, before.stat)) {
				throw new ScanProblem('unstable');
			}
			await guard(base, relativePath);
			const buffer = Buffer.alloc(Number(opened.size));
			for (let offset = 0; offset < buffer.length;) {
				checkCancelled();
				const chunk = await handle.read(buffer, offset, Math.min(64 * 1024, buffer.length - offset), offset);
				result.bytesRead += chunk.bytesRead;
				checkCancelled();
				if (chunk.bytesRead === 0) {
					throw new ScanProblem('unstable');
				}
				offset += chunk.bytesRead;
			}
			checkCancelled();
			const probe = await handle.read(Buffer.alloc(1), 0, 1, buffer.length);
			result.bytesRead += probe.bytesRead;
			checkCancelled();
			if (probe.bytesRead !== 0) {
				throw new ScanProblem('unstable');
			}
			if (!sameVersion(opened, await read(() => handle.stat({ bigint: true }))) || !sameVersion(opened, (await guard(base, relativePath)).stat)) {
				throw new ScanProblem('unstable');
			}
			return buffer;
		} finally {
			await handle.close();
		}
	};
	const visit = async (relativePath: string, left: Root, right: Root, depth: number, leftExists = true, rightExists = true): Promise<void> => {
		checkCancelled();
		if (result.examined >= limits.entries) {
			throw new ScanProblem('entries');
		}
		try {
			const a = leftExists ? await guard(left, relativePath) : undefined;
			const b = rightExists ? await guard(right, relativePath) : undefined;
			const present = a ?? b;
			if (!present) {
				throw new ScanProblem('unstable');
			}
			if ((a?.stat.isDirectory() && b?.stat.isFile()) || (a?.stat.isFile() && b?.stat.isDirectory())) {
				result.entries.push({ path: relativePath, status: 'changed', reason: 'type' });
				return;
			}
			if (present.stat.isDirectory()) {
				if (depth >= limits.depth) {
					throw new ScanProblem('depth');
				}
				const leftNames = a ? await directory(left, relativePath) : new Set<string>();
				const rightNames = b ? await directory(right, relativePath) : new Set<string>();
				if (relativePath && (!a || !b)) {
					result.entries.push({ path: relativePath, status: a ? 'removed' : 'added', reason: 'directory' });
				}
				for (const name of [...new Set([...leftNames, ...rightNames])].sort()) {
					await visit(relativePath ? `${relativePath}/${name}` : name, left, right, depth + 1, leftNames.has(name), rightNames.has(name));
				}
			} else {
				const original = a ? await file(left, relativePath, a.stat) : undefined;
				const modified = b ? await file(right, relativePath, b.stat) : undefined;
				if (!original || !modified || !original.equals(modified)) {
					result.entries.push({ path: relativePath, status: a ? b ? 'changed' : 'removed' : 'added', original, modified });
				}
			}
		} catch (error) {
			if (error instanceof Cancelled || (error instanceof ScanProblem && (error.reason === 'entries' || error.reason === 'time'))) {
				throw error;
			}
			skipped(relativePath, error);
		}
	};
	try {
		checkCancelled();
		if (process.platform === 'win32' || typeof fs.constants.O_NOFOLLOW !== 'number' || typeof fs.constants.O_NONBLOCK !== 'number') {
			throw new ScanProblem('unsupported');
		}
		const left = await root(leftPath);
		const right = await root(rightPath);
		await visit('', left, right, 0);
	} catch (error) {
		if (error instanceof Cancelled) {
			result.cancelled = true;
		} else {
			skipped('', error);
		}
	}
	result.entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
	return result;
}
