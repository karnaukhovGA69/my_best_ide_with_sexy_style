/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { constants, type Stats } from 'node:fs';
import { access, lstat, realpath } from 'node:fs/promises';
import { basename, join } from 'node:path';

export type SchemaErrorCode = 'target' | 'target-changed' | 'launch' | 'timeout' | 'output-limit' | 'credentials' | 'client-version' | 'connection' | 'invalid-result';

export class SchemaError extends Error {
	constructor(readonly code: SchemaErrorCode) {
		super(code);
	}
}

export interface LocalTarget {
	readonly executable: string;
	readonly socketDirectory: string;
	readonly database: string;
	readonly role: string;
	readonly port: number;
}

export interface TargetSnapshot {
	readonly target: LocalTarget;
	readonly identity: string;
}

/** Accept a single literal Unix path, with no dot segments or display-control characters. */
export function isLiteralAbsolutePath(value: string): boolean {
	return value.startsWith('/') && !value.startsWith('//') && !/[\p{Cc}\p{Bidi_Control}]/u.test(value)
		&& !value.split('/').some(segment => segment === '.' || segment === '..');
}

/** Restrict names to literal PostgreSQL identifiers without connection-string syntax. */
export function isLiteralIdentifier(value: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/.test(value);
}

export function isPort(port: number): boolean {
	return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isSocketDirectory(path: string): boolean {
	// libpq treats commas in the host parameter as a list of distinct destinations.
	return isLiteralAbsolutePath(path) && !path.includes(',');
}

/** Validate every input used to form the process arguments. */
export function isLocalTarget(target: LocalTarget): boolean {
	return isLiteralAbsolutePath(target.executable) && isSocketDirectory(target.socketDirectory)
		&& isLiteralIdentifier(target.database) && isLiteralIdentifier(target.role) && isPort(target.port);
}

/** Resolve the explicitly picked paths and verify a real Unix socket and executable. */
export async function inspectTarget(picked: LocalTarget): Promise<TargetSnapshot> {
	if (!isLocalTarget(picked) || basename(picked.executable) !== 'psql') {
		throw new SchemaError('target');
	}
	try {
		const [executable, socketDirectory] = await Promise.all([realpath(picked.executable), realpath(picked.socketDirectory)]);
		const target = { ...picked, executable, socketDirectory };
		if (!isLocalTarget(target)) {
			throw new SchemaError('target');
		}
		const [binary, directory, socket] = await Promise.all([
			lstat(executable), lstat(socketDirectory), lstat(join(socketDirectory, `.s.PGSQL.${target.port}`)),
		]);
		if (!binary.isFile() || (binary.mode & 0o022) !== 0 || !directory.isDirectory() || !socket.isSocket() || (directory.mode & 0o022) !== 0) {
			throw new SchemaError('target');
		}
		await access(executable, constants.X_OK);
		return { target, identity: JSON.stringify([target, statIdentity(binary), statIdentity(directory), statIdentity(socket)]) };
	} catch {
		throw new SchemaError('target');
	}
}

function statIdentity(stat: Stats): readonly number[] {
	return [stat.dev, stat.ino, stat.mode, stat.uid, stat.size, stat.ctimeMs];
}
