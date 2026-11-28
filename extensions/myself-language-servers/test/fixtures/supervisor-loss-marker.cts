/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FileHandle } from 'node:fs/promises';

const { randomUUID } = require('node:crypto');
const { constants } = require('node:fs');
const { lstat, open, rename, unlink, writeFile } = require('node:fs/promises');

type RuntimeState = 'starting' | 'running' | 'unknown';
type RuntimeMarker = { version: 1; generation: string; state: RuntimeState };
type MarkerRead = RuntimeMarker | 'absent' | 'invalid';

const markerLimit = 512;
const generationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function readRuntimeMarker(path: string): Promise<MarkerRead> {
	let handle: FileHandle;
	try {
		handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'invalid';
	}
	try {
		const info = await handle.stat({ bigint: true });
		const named = await lstat(path, { bigint: true });
		if (!info.isFile() || info.uid !== BigInt(process.getuid!()) || info.nlink !== 1n
			|| (info.mode & 0o777n) !== 0o600n || info.ino !== named.ino || info.dev !== named.dev
			|| info.size < 1n || info.size > BigInt(markerLimit)) {
			return 'invalid';
		}

		const storage = Buffer.alloc(markerLimit + 1);
		const { bytesRead } = await handle.read(storage, 0, storage.length, 0);
		if (BigInt(bytesRead) !== info.size) {
			return 'invalid';
		}
		const parsed: Partial<RuntimeMarker> = JSON.parse(storage.subarray(0, bytesRead).toString('utf8'));
		if (parsed?.version === 1 && Object.keys(parsed).length === 3 && typeof parsed.generation === 'string'
			&& generationPattern.test(parsed.generation)
			&& (parsed.state === 'starting' || parsed.state === 'running' || parsed.state === 'unknown')) {
			return { version: 1, generation: parsed.generation, state: parsed.state };
		}
		return 'invalid';
	} catch {
		return 'invalid';
	} finally {
		await handle.close();
	}
}

// Every writer is a fixture actor holding the corresponding UUID lease.
async function writeRuntimeMarker(path: string, marker: RuntimeMarker): Promise<void> {
	await writeFile(path, JSON.stringify(marker), { flag: 'wx', mode: 0o600 });
}

async function replaceRuntimeMarker(path: string, marker: RuntimeMarker): Promise<void> {
	const temp = path + '.tmp-' + randomUUID();
	await writeRuntimeMarker(temp, marker);
	try {
		await rename(temp, path);
	} catch (error) {
		await unlink(temp);
		throw error;
	}
}

module.exports = { readRuntimeMarker, replaceRuntimeMarker, writeRuntimeMarker };

export type { MarkerRead, RuntimeMarker };
