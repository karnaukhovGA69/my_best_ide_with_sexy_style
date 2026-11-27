/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { constants } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';

// Darwin <sys/fcntl.h>. Node accepts the numeric open flag but does not export it.
const O_EXLOCK = 0x20;

/** Locks a stable file inside the private managed directory. Never unlink a lease file. */
export async function tryAcquireLease(path: string): Promise<FileHandle | undefined> {
	if (process.platform !== 'darwin' || process.arch !== 'arm64') {
		throw new Error('Managed package leases require macOS ARM64.');
	}
	let handle: FileHandle;
	try {
		handle = await open(path, constants.O_RDWR | constants.O_CREAT | constants.O_NONBLOCK | constants.O_NOFOLLOW | O_EXLOCK, 0o600);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === 'EAGAIN' || code === 'EWOULDBLOCK') {
			return undefined;
		}
		throw error;
	}
	try {
		const stat = await handle.stat({ bigint: true });
		const named = await lstat(path, { bigint: true });
		if (!stat.isFile() || stat.uid !== BigInt(process.getuid!()) || stat.nlink !== 1n || (stat.mode & 0o077n)
			|| named.dev !== stat.dev || named.ino !== stat.ino) {
			throw new Error('Invalid managed package lease file.');
		}
		return handle;
	} catch (error) {
		await handle.close();
		throw error;
	}
}
