/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { Schemas } from '../../../../base/common/network.js';
import { joinPath } from '../../../../base/common/resources.js';
import { parse } from '../../../../base/common/semver/semver.js';
import type { URI } from '../../../../base/common/uri.js';
import { EXTENSION_IDENTIFIER_REGEX } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { isValidVersionStr } from '../../../../platform/extensions/common/extensionValidator.js';
import { FileSystemProviderErrorCode, FileType, type IFileService, type IStat, toFileSystemProviderErrorCode } from '../../../../platform/files/common/files.js';
import { isLocalVsixArchiveBasename, type ILocalVsixSet, type ILocalVsixSetEntry } from '../common/localVsixSet.js';
import { localVsixArchiveMaxMiB, localVsixSetReadMaxMiB } from './localVsixSetChecksums.js';

const MiB = 1024 * 1024;
const metadataLimits = { archiveBytes: localVsixArchiveMaxMiB * MiB, totalSourceBytes: localVsixSetReadMaxMiB * MiB };

export interface ILocalVsixInspection {
	readonly id: string;
	readonly version: string;
	readonly engine: string;
	readonly sha256: string;
	readonly bytes: number;
}

/** The backend must enforce maxBytes before reading, with at most one extra byte to detect growth. */
export type LocalVsixInspector = (resource: URI, maxBytes: number, token: CancellationToken) => Promise<ILocalVsixInspection | undefined>;

export type LocalVsixMetadataStatus =
	| { readonly kind: 'missing' | 'unavailable' }
	| {
		readonly kind: 'checked';
		readonly inspection: ILocalVsixInspection;
		readonly idMatches: boolean;
		readonly versionMatches: boolean;
		readonly sha256Matches: boolean;
	};

function isInspection(value: ILocalVsixInspection | undefined, expectedSize: number): value is ILocalVsixInspection {
	if (!value || value.bytes !== expectedSize || typeof value.id !== 'string' || value.id.length > 128
		|| value.id !== value.id.toLowerCase() || !EXTENSION_IDENTIFIER_REGEX.test(value.id)
		|| typeof value.version !== 'string' || value.version.length > 64
		|| typeof value.engine !== 'string' || value.engine.length > 128 || value.engine.trim() !== value.engine
		|| /[\p{Cc}\p{Cf}]/u.test(value.engine) || !isValidVersionStr(value.engine)
		|| typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) {
		return false;
	}
	const version = parse(value.version);
	return !!version && value.version === version.version + (version.build.length ? '+' + version.build.join('.') : '');
}

/** Inspect one proven basename at a time, reserving read budget even if an inspection fails. */
export async function inspectLocalVsixSet(
	files: Pick<IFileService, 'getProvider'>,
	inspect: LocalVsixInspector,
	directory: URI,
	set: ILocalVsixSet,
	token: CancellationToken,
	limits = metadataLimits,
): Promise<readonly LocalVsixMetadataStatus[] | undefined> {
	if (token.isCancellationRequested) {
		return undefined;
	}
	const unavailable = (): LocalVsixMetadataStatus[] => set.entries.map(() => ({ kind: 'unavailable' }));
	if (directory.scheme !== Schemas.file || directory.authority || directory.query || directory.fragment
		|| !directory.path.startsWith('/') || directory.path.startsWith('//')) {
		return unavailable();
	}
	const provider = files.getProvider(Schemas.file);
	if (!provider) {
		return unavailable();
	}
	const isCurrent = () => !token.isCancellationRequested && files.getProvider(Schemas.file) === provider;
	let beforeDirectory: IStat;
	try {
		beforeDirectory = await provider.stat(directory);
		if (beforeDirectory.type !== FileType.Directory) {
			return isCurrent() ? unavailable() : undefined;
		}
	} catch {
		return isCurrent() ? unavailable() : undefined;
	}

	let remaining = limits.totalSourceBytes;
	const checkEntry = async (entry: ILocalVsixSetEntry): Promise<LocalVsixMetadataStatus> => {
		if (!isLocalVsixArchiveBasename(entry.file)) {
			return { kind: 'unavailable' };
		}
		const archive = joinPath(directory, entry.file);
		try {
			const before = await provider.stat(archive);
			if (before.type !== FileType.File || !Number.isSafeInteger(before.size) || before.size < 22
				|| before.size > limits.archiveBytes || before.size + 1 > remaining || !isCurrent()) {
				return { kind: 'unavailable' };
			}
			remaining -= before.size + 1;
			const actual = await inspect(archive, before.size, token);
			if (!isCurrent() || !isInspection(actual, before.size)) {
				return { kind: 'unavailable' };
			}
			const after = await provider.stat(archive);
			if (after.type !== FileType.File || after.size !== before.size || after.mtime !== before.mtime || after.ctime !== before.ctime) {
				return { kind: 'unavailable' };
			}
			return {
				kind: 'checked', inspection: actual,
				idMatches: actual.id === entry.id,
				versionMatches: actual.version === entry.version,
				sha256Matches: actual.sha256 === entry.sha256,
			};
		} catch (error) {
			return { kind: toFileSystemProviderErrorCode(error) === FileSystemProviderErrorCode.FileNotFound ? 'missing' : 'unavailable' };
		}
	};

	const results: LocalVsixMetadataStatus[] = [];
	for (const entry of set.entries) {
		if (!isCurrent()) {
			return undefined;
		}
		results.push(await checkEntry(entry));
	}
	if (!isCurrent()) {
		return undefined;
	}
	try {
		const after = await provider.stat(directory);
		return isCurrent() && after.type === FileType.Directory && after.mtime === beforeDirectory.mtime && after.ctime === beforeDirectory.ctime
			? results : undefined;
	} catch {
		return undefined;
	}
}
