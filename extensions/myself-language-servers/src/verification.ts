/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, opendir } from 'node:fs/promises';
import { join } from 'node:path';
import { computeTreeDigest, entryLimit, fileLimit, isMacArm64ExecutableHandle, isPortableArchivePath, registerArchivePath, totalLimit, type TreeDigestEntry } from './archive';

export type PackageVerificationResult = 'verified' | 'busy' | 'invalid-manifest' | 'unexpected-layout' | 'unsafe-entry'
	| 'tree-mismatch' | 'invalid-entrypoint' | 'limits-exceeded' | 'path-encoding' | 'changed' | 'unreadable';

export class PackageVerificationError extends Error {
	constructor(readonly result: Exclude<PackageVerificationResult, 'verified' | 'busy' | 'unreadable'>) {
		super(result);
	}
}

export function assertPrivateDirectory(stat: BigIntStats): void {
	if (!stat.isDirectory() || stat.uid !== BigInt(process.getuid!()) || (stat.mode & 0o077n)) {
		throw new PackageVerificationError('unsafe-entry');
	}
}

export function assertRegularPackageFile(stat: BigIntStats): void {
	if (!stat.isFile() || stat.nlink !== 1n || stat.uid !== BigInt(process.getuid!()) || (stat.mode & 0o022n)) {
		throw new PackageVerificationError('unsafe-entry');
	}
}

export function assertUnchanged(initial: BigIntStats, current: BigIntStats): void {
	if (current.dev !== initial.dev || current.ino !== initial.ino || current.mode !== initial.mode
		|| current.nlink !== initial.nlink || current.uid !== initial.uid || current.size !== initial.size
		|| current.mtimeNs !== initial.mtimeNs || current.ctimeNs !== initial.ctimeNs) {
		throw new PackageVerificationError('changed');
	}
}

export async function verifyPackageTree(
	payload: string,
	entryRelative: string,
	expectedTree: string,
	signal?: AbortSignal,
): Promise<PackageVerificationResult> {
	const entries: TreeDigestEntry[] = [];
	const observations: [path: string, stat: BigIntStats][] = [];
	const nodes = new Map<string, { path: string; directory: boolean; explicit: boolean }>();
	const buffer = Buffer.allocUnsafe(64 * 1024);
	let totalBytes = 0;
	let entrypointCompatible = false;
	let namesMayBeNormalized = false;

	await visitDirectory(payload, '');
	signal?.throwIfAborted();
	const { files, treeSha256 } = computeTreeDigest(entries);
	// v1 did not store the original path strings. A filesystem can change
	// spelling through Unicode normalization while preserving file contents.
	if (treeSha256 !== expectedTree) {
		return namesMayBeNormalized ? 'path-encoding' : 'tree-mismatch';
	}
	if (!entrypointCompatible) {
		if (!files.includes(entryRelative) && files.some(file => file.normalize('NFC') === entryRelative.normalize('NFC'))) {
			return 'path-encoding';
		}
		return 'invalid-entrypoint';
	}
	// A file or nested directory checked early can change while later files are read.
	for (const [path, stat] of observations) {
		await checkNamedPath(path, stat);
	}
	return 'verified';

	async function visitDirectory(path: string, relative: string): Promise<void> {
		signal?.throwIfAborted();
		const initial = await lstat(path, { bigint: true });
		assertPrivateDirectory(initial);
		for await (const child of await opendir(path)) {
			signal?.throwIfAborted();
			await checkNamedPath(path, initial);
			const name = join(path, child.name);
			const childRelative = relative ? relative + '/' + child.name : child.name;
			if (!isPortableArchivePath(childRelative)) {
				throw new PackageVerificationError('unsafe-entry');
			}
			const stat = await lstat(name, { bigint: true });
			if (!stat.isDirectory()) {
				assertRegularPackageFile(stat);
			}
			if (nodes.size >= entryLimit) {
				throw new PackageVerificationError('limits-exceeded');
			}
			try {
				registerArchivePath(nodes, childRelative, stat.isDirectory());
			} catch {
				throw new PackageVerificationError('unsafe-entry');
			}
			if (stat.isDirectory()) {
				await visitDirectory(name, childRelative);
			} else {
				namesMayBeNormalized ||= childRelative !== childRelative.normalize('NFC') || childRelative !== childRelative.normalize('NFD');
				await visitFile(name, childRelative, stat);
			}
		}
		await checkNamedPath(path, initial);
		observations.push([path, initial]);
	}

	async function visitFile(path: string, relative: string, initial: BigIntStats): Promise<void> {
		signal?.throwIfAborted();
		if (initial.size > BigInt(fileLimit) || initial.size > BigInt(totalLimit - totalBytes)) {
			throw new PackageVerificationError('limits-exceeded');
		}
		const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		try {
			assertUnchanged(initial, await handle.stat({ bigint: true }));
			const size = Number(initial.size);
			const hash = createHash('sha256');
			let offset = 0;
			while (offset < size) {
				signal?.throwIfAborted();
				const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, size - offset), offset);
				if (bytesRead === 0) {
					throw new PackageVerificationError('changed');
				}
				offset += bytesRead;
				totalBytes += bytesRead;
				hash.update(buffer.subarray(0, bytesRead));
			}
			signal?.throwIfAborted();
			const { bytesRead } = await handle.read(buffer, 0, 1, offset);
			if (bytesRead !== 0) {
				throw new PackageVerificationError('changed');
			}
			signal?.throwIfAborted();
			if (relative === entryRelative) {
				entrypointCompatible = await isMacArm64ExecutableHandle(handle, size);
			}
			assertUnchanged(initial, await handle.stat({ bigint: true }));
			await checkNamedPath(path, initial);
			entries.push([relative, size, hash.digest('hex')]);
			observations.push([path, initial]);
		} finally {
			await handle.close();
		}
	}

	async function checkNamedPath(path: string, initial: BigIntStats): Promise<void> {
		signal?.throwIfAborted();
		assertUnchanged(initial, await lstat(path, { bigint: true }));
	}
}
