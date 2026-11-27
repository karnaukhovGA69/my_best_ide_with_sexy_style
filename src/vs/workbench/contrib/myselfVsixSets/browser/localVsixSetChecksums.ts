/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { Schemas } from '../../../../base/common/network.js';
import { joinPath } from '../../../../base/common/resources.js';
import type { URI } from '../../../../base/common/uri.js';
import { FileSystemProviderErrorCode, FileType, hasOpenReadWriteCloseCapability, type IFileService, toFileSystemProviderErrorCode } from '../../../../platform/files/common/files.js';
import type { ILocalVsixSet, ILocalVsixSetEntry } from '../common/localVsixSet.js';

export const localVsixArchiveMaxMiB = 32;
export const localVsixSetReadMaxMiB = 128;
const MiB = 1024 * 1024;

const defaultLimits = {
	archiveBytes: localVsixArchiveMaxMiB * MiB,
	totalReadBytes: localVsixSetReadMaxMiB * MiB,
};

export type LocalVsixChecksumStatus = 'match' | 'mismatch' | 'missing' | 'unavailable';

/** Check bytes from the validated basenames beside the already approved local manifest. */
export async function checkLocalVsixSetChecksums(
	files: Pick<IFileService, 'getProvider'>,
	directory: URI,
	set: ILocalVsixSet,
	token: CancellationToken,
	limits = defaultLimits,
): Promise<readonly LocalVsixChecksumStatus[] | undefined> {
	if (token.isCancellationRequested) {
		return undefined;
	}

	const unavailable = () => set.entries.map(() => 'unavailable' as const);
	const crypto = globalThis.crypto?.subtle;
	const provider = files.getProvider(Schemas.file);
	if (!crypto || !provider || !hasOpenReadWriteCloseCapability(provider)) {
		return unavailable();
	}
	const canCheck = () => !token.isCancellationRequested && files.getProvider(Schemas.file) === provider;
	try {
		if ((await provider.stat(directory)).type !== FileType.Directory) {
			return token.isCancellationRequested ? undefined : unavailable();
		}
	} catch {
		return token.isCancellationRequested ? undefined : unavailable();
	}

	let remainingBytes = limits.totalReadBytes;
	const checkArchive = async (entry: ILocalVsixSetEntry): Promise<LocalVsixChecksumStatus> => {
		const resource = joinPath(directory, entry.file);
		try {
			const stat = await provider.stat(resource);
			// Reserve a byte for the EOF check, even for an archive at the size limit.
			if (stat.type !== FileType.File || !Number.isSafeInteger(stat.size) || stat.size < 0
				|| stat.size > limits.archiveBytes || stat.size + 1 > remainingBytes || !canCheck()) {
				return 'unavailable';
			}

			const buffer = new Uint8Array(stat.size + 1);
			const handle = await provider.open(resource, { create: false });
			let offset = 0;
			try {
				while (offset < buffer.length && canCheck()) {
					const requested = Math.min(MiB, buffer.length - offset);
					const read = await provider.read(handle, offset, buffer, offset, requested);
					if (!Number.isSafeInteger(read) || read < 0 || read > requested) {
						return 'unavailable';
					}
					remainingBytes -= read;
					if (read === 0) {
						break;
					}
					offset += read;
				}
			} finally {
				await provider.close(handle);
			}
			if (offset !== stat.size || !canCheck()) {
				return 'unavailable';
			}

			// Detect visible changes during the read. The provider does not expose
			// a no-follow open or the identity of the file descriptor's target.
			const after = await provider.stat(resource);
			if (after.type !== FileType.File || after.size !== stat.size || after.mtime !== stat.mtime || after.ctime !== stat.ctime || !canCheck()) {
				return 'unavailable';
			}
			const digest = await crypto.digest('SHA-256', buffer.subarray(0, offset));
			if (!canCheck()) {
				return 'unavailable';
			}
			const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
			return actual === entry.sha256 ? 'match' : 'mismatch';
		} catch (error) {
			return toFileSystemProviderErrorCode(error) === FileSystemProviderErrorCode.FileNotFound ? 'missing' : 'unavailable';
		}
	};

	const results: LocalVsixChecksumStatus[] = [];
	for (const entry of set.entries) {
		if (!canCheck()) {
			return token.isCancellationRequested ? undefined : unavailable();
		}
		results.push(await checkArchive(entry));
	}
	if (token.isCancellationRequested) {
		return undefined;
	}
	return canCheck() ? results : unavailable();
}
