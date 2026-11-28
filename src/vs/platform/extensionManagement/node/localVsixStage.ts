/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { constants, type BigIntStats } from 'node:fs';
import { lstat, mkdtemp, open, rm, rmdir, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CancellationToken } from '../../../base/common/cancellation.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Schemas } from '../../../base/common/network.js';
import type { URI } from '../../../base/common/uri.js';
import type { ILocalVsixInspection } from '../common/extensionManagementIpc.js';
import { inspectStagedVsix, type ILocalVsixMetadata } from './localVsixInspect.js';

const maxBytes = 32 * 1024 * 1024;
const copyChunkBytes = 64 * 1024;

export interface IStagedLocalVsix {
	/** Internal path valid only during the consumer callback. */
	readonly path: string;
	readonly bytes: number;
	readonly sha256: string;
	readonly metadata: ILocalVsixMetadata;
}

export class LocalVsixStageError extends Error {
	constructor(readonly code: 'invalid-source' | 'unsupported-platform' | 'source-size' | 'source-changed'
		| 'stage-unavailable' | 'invalid-archive' | 'stage-changed' | 'cleanup-failed') {
		super(code);
	}
}

/** Stage one explicitly selected local VSIX. No authorization for subsequent installation is implied. */
export async function withStagedLocalVsix<T>(
	source: URI,
	token: CancellationToken,
	consume: (stage: IStagedLocalVsix) => Promise<T>,
	maxSourceBytes = maxBytes,
): Promise<T> {
	const checkCancelled = () => {
		if (token.isCancellationRequested) {
			throw new CancellationError();
		}
	};
	checkCancelled();
	if (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes < 22 || maxSourceBytes > maxBytes) {
		throw new LocalVsixStageError('source-size');
	}
	if (source.scheme !== Schemas.file || source.authority || source.query || source.fragment
		|| !source.path.startsWith('/') || !source.path.toLowerCase().endsWith('.vsix') || /[\\\0]/.test(source.path)
		|| source.path.slice(1).split('/').some(segment => !segment || segment === '.' || segment === '..')) {
		throw new LocalVsixStageError('invalid-source');
	}
	if (typeof process.getuid !== 'function' || !constants.O_NOFOLLOW || !constants.O_NONBLOCK) {
		throw new LocalVsixStageError('unsupported-platform');
	}

	let directory: string;
	try {
		directory = await mkdtemp(join(tmpdir(), 'nerded-local-vsix-'));
	} catch {
		throw new LocalVsixStageError('stage-unavailable');
	}
	const path = join(directory, 'package.vsix');
	let identity: BigIntStats | undefined;
	let created = false;
	try {
		try {
			identity = await lstat(directory, { bigint: true });
		} catch {
			throw new LocalVsixStageError('stage-unavailable');
		}
		checkCancelled();
		if (!identity.isDirectory() || identity.uid !== BigInt(process.getuid()) || (identity.mode & 0o077n)) {
			throw new LocalVsixStageError('stage-unavailable');
		}
		let artifact: IStagedLocalVsix;
		let snapshot: BigIntStats;
		try {
			const staged = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
			created = true;
			try {
				const { bytes, sha256 } = await copySource(source.path, staged, maxSourceBytes, checkCancelled);
				snapshot = await staged.stat({ bigint: true });
				if (!snapshot.isFile() || snapshot.size !== BigInt(bytes) || (snapshot.mode & 0o077n)
					|| snapshot.uid !== identity.uid || snapshot.nlink !== 1n || !sameFile(snapshot, await lstat(path, { bigint: true }))) {
					throw new LocalVsixStageError('stage-changed');
				}
				if (await hashSnapshot(staged, bytes, checkCancelled) !== sha256) {
					throw new LocalVsixStageError('stage-changed');
				}
				checkCancelled();
				let metadata: ILocalVsixMetadata;
				try {
					metadata = await inspectStagedVsix(staged, bytes, checkCancelled);
				} catch {
					checkCancelled();
					throw new LocalVsixStageError('invalid-archive');
				}
				if (!sameFile(snapshot, await staged.stat({ bigint: true }))) {
					throw new LocalVsixStageError('stage-changed');
				}
				artifact = Object.freeze({ path, bytes, sha256, metadata });
			} finally {
				await staged.close();
			}
			if (!sameFile(snapshot, await lstat(path, { bigint: true }))) {
				throw new LocalVsixStageError('stage-changed');
			}
		} catch (error) {
			checkCancelled();
			throw error instanceof LocalVsixStageError ? error : new LocalVsixStageError('stage-unavailable');
		}
		checkCancelled();
		return await consume(artifact);
	} finally {
		await removeStage(directory, created ? path : undefined, identity);
	}
}

/** Return bounded metadata only after the temporary snapshot is closed and removed. */
export async function inspectLocalVsixV1(source: URI, maxSourceBytes: number, token: CancellationToken): Promise<ILocalVsixInspection | undefined> {
	try {
		const result = await withStagedLocalVsix(source, token, async ({ metadata, sha256, bytes }) => Object.freeze({
			...metadata, sha256, bytes,
		}), maxSourceBytes);
		if (token.isCancellationRequested) {
			throw new CancellationError();
		}
		return result;
	} catch {
		if (token.isCancellationRequested) {
			throw new CancellationError();
		}
		return undefined;
	}
}

async function removeStage(directory: string, path: string | undefined, identity: BigIntStats | undefined): Promise<void> {
	try {
		if (identity) {
			const current = await lstat(directory, { bigint: true });
			if (!current.isDirectory() || identity.ino !== current.ino || identity.dev !== current.dev || identity.uid !== current.uid) {
				throw new LocalVsixStageError('cleanup-failed');
			}
		}
		if (path) {
			await rm(path, { force: true });
		}
		await rmdir(directory);
	} catch {
		throw new LocalVsixStageError('cleanup-failed');
	}
}

async function copySource(path: string, staged: FileHandle, maxSourceBytes: number, checkCancelled: () => void): Promise<{ bytes: number; sha256: string }> {
	checkCancelled();
	const before = await lstat(path, { bigint: true });
	if (!before.isFile()) {
		throw new LocalVsixStageError('invalid-source');
	}
	checkSourceSize(before, maxSourceBytes);
	checkCancelled();
	const source = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		if (!sameFile(before, await source.stat({ bigint: true }))) {
			throw new LocalVsixStageError('source-changed');
		}
		const hash = createHash('sha256');
		const buffer = Buffer.allocUnsafe(copyChunkBytes);
		const bytes = Number(before.size);
		for (let offset = 0; offset < bytes;) {
			checkCancelled();
			const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.length, bytes - offset), offset);
			if (!bytesRead) {
				throw new LocalVsixStageError('source-changed');
			}
			for (let written = 0; written < bytesRead;) {
				checkCancelled();
				const { bytesWritten } = await staged.write(buffer, written, bytesRead - written, offset + written);
				if (!bytesWritten) {
					throw new LocalVsixStageError('stage-unavailable');
				}
				hash.update(buffer.subarray(written, written + bytesWritten));
				written += bytesWritten;
			}
			offset += bytesRead;
		}
		checkCancelled();
		const { bytesRead } = await source.read(buffer, 0, 1, bytes);
		if (bytesRead || !sameFile(before, await source.stat({ bigint: true })) || !sameFile(before, await lstat(path, { bigint: true }))) {
			throw new LocalVsixStageError('source-changed');
		}
		return { bytes, sha256: hash.digest('hex') };
	} finally {
		await source.close();
	}
}

async function hashSnapshot(staged: FileHandle, bytes: number, checkCancelled: () => void): Promise<string> {
	const hash = createHash('sha256');
	const buffer = Buffer.allocUnsafe(copyChunkBytes);
	for (let offset = 0; offset < bytes;) {
		checkCancelled();
		const { bytesRead } = await staged.read(buffer, 0, Math.min(buffer.length, bytes - offset), offset);
		if (!bytesRead) {
			throw new LocalVsixStageError('stage-changed');
		}
		hash.update(buffer.subarray(0, bytesRead));
		offset += bytesRead;
	}
	return hash.digest('hex');
}

function checkSourceSize(stat: BigIntStats, maxSourceBytes: number): void {
	if (stat.size < 22n || stat.size > BigInt(maxSourceBytes)) {
		throw new LocalVsixStageError('source-size');
	}
}

function sameFile(before: BigIntStats, after: BigIntStats): boolean {
	return after.isFile() && before.dev === after.dev && before.ino === after.ino && before.mode === after.mode
		&& before.uid === after.uid && before.nlink === after.nlink && before.size === after.size
		&& before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}
