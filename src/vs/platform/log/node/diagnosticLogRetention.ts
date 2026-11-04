/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { lstat, open, rename, unlink, utimes } from 'fs/promises';
import { parse, join } from '../../../base/common/path.js';
import type { ILoggerOptions } from '../common/log.js';

export const diagnosticLogMaxFileSize = 2 * 1024 * 1024;
export const diagnosticLogBackupCount = 4;
const maxAge = 7 * 24 * 60 * 60 * 1000;

/** Raw Output and extension-owned channels retain their original behavior. */
export function isCoreDiagnosticLogger(options?: ILoggerOptions): boolean {
	return !options?.extensionId && !options?.donotRotate && !options?.donotUseFormatters && options?.logLevel !== 'always';
}

/** Native spdlog names its backups main.1.log, main.2.log, etc. */
function backupPath(filepath: string, index: number): string {
	const { dir, name, ext } = parse(filepath);
	return join(dir, `${name}.${index}${ext}`);
}

/** Prepares only this channel's files while its native writer is closed. */
export async function prepareDiagnosticLog(filepath: string, now: number, forceRotate = false): Promise<void> {
	let rotate = forceRotate;
	// Six backups were used by the upstream logger. Remove only those exact legacy files.
	for (let index = 0; index <= 6; index++) {
		const file = index ? backupPath(filepath, index) : filepath;
		let stat;
		try {
			stat = await lstat(file);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				continue;
			}
			throw error;
		}
		if (!stat.isFile()) {
			throw new Error('Diagnostic log retention only accepts regular files.');
		}
		if (index > diagnosticLogBackupCount || now - stat.mtimeMs >= maxAge) {
			await unlink(file);
			continue;
		}
		if (index === 0 && Math.floor(stat.mtimeMs / 86400000) !== Math.floor(now / 86400000)) {
			rotate = true;
		}
		if (stat.size > diagnosticLogMaxFileSize) {
			const handle = await open(file, 'r+');
			try {
				const tail = Buffer.alloc(diagnosticLogMaxFileSize);
				const { bytesRead } = await handle.read(tail, 0, tail.length, stat.size - tail.length);
				const newline = tail.indexOf(10);
				const content = tail.subarray(newline >= 0 ? newline + 1 : 0, bytesRead);
				await handle.truncate(0);
				await handle.write(content, 0, content.length, 0);
			} finally {
				await handle.close();
			}
			await utimes(file, stat.atime, stat.mtime);
		}
	}
	if (rotate) {
		await unlink(backupPath(filepath, diagnosticLogBackupCount)).catch(error => {
			if (error.code !== 'ENOENT') { throw error; }
		});
		for (let index = diagnosticLogBackupCount - 1; index >= 0; index--) {
			await rename(index ? backupPath(filepath, index) : filepath, backupPath(filepath, index + 1)).catch(error => {
				if (error.code !== 'ENOENT') { throw error; }
			});
		}
	}
}
