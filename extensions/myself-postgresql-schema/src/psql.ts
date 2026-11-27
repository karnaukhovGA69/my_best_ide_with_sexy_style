/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { parseSchemaOutput, schemaSql, type SchemaSnapshot } from './schema.js';
import { isLocalTarget, SchemaError, type LocalTarget, type SchemaErrorCode } from './target.js';

export const maxStdout = 256 * 1024;
export const maxStderr = 8 * 1024;
const processTimeoutMs = 8000;

type LaunchPsql = (file: string, args: string[], options: SpawnOptions) => ChildProcess;

/** Execute the fixed schema query. The caller supplies a checked and confirmed target. */
export async function runSchema(target: LocalTarget, signal: AbortSignal, launch: LaunchPsql = spawn, timeoutMs = processTimeoutMs): Promise<SchemaSnapshot | undefined> {
	if (signal.aborted) {
		return undefined;
	}
	if (!isLocalTarget(target)) {
		throw new SchemaError('target');
	}
	const args = [
		'-X', '-w', '--quiet', '--no-align', '--tuples-only', '--pset=pager=off', '--set=ON_ERROR_STOP=1',
		`--host=${target.socketDirectory}`, `--port=${target.port}`, `--username=${target.role}`,
		// The only variable in the conninfo is the prevalidated identifier. Older
		// libpq versions reject require_auth instead of ignoring it as an env var.
		`--dbname=dbname=${target.database} require_auth=none passfile=/dev/null connect_timeout=3`,
		'--command', schemaSql,
	];
	return new Promise((resolve, reject) => {
		let child: ChildProcess;
		try {
			child = launch(target.executable, args, {
				cwd: '/', shell: false, stdio: ['ignore', 'pipe', 'pipe'],
				env: { LC_ALL: 'C', LANG: 'C', PGCLIENTENCODING: 'UTF8' },
			});
		} catch {
			reject(new SchemaError('launch'));
			return;
		}
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		let outBytes = 0;
		let errBytes = 0;
		let finished = false;
		const cleanup = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', abort);
		};
		const stop = (reason: SchemaErrorCode | 'aborted') => {
			if (finished) {
				return;
			}
			finished = true;
			cleanup();
			child.kill('SIGKILL');
			child.stdout?.destroy();
			child.stderr?.destroy();
			if (reason === 'aborted') {
				resolve(undefined);
			} else {
				reject(new SchemaError(reason));
			}
		};
		const abort = () => stop('aborted');
		const timer = setTimeout(() => stop('timeout'), timeoutMs);
		child.stdout?.on('data', (chunk: Buffer) => {
			outBytes += chunk.length;
			if (outBytes > maxStdout) {
				stop('output-limit');
			} else if (!finished) {
				stdout.push(chunk);
			}
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			errBytes += chunk.length;
			if (errBytes > maxStderr) {
				stop('output-limit');
			} else if (!finished) {
				stderr.push(chunk);
			}
		});
		child.on('error', () => stop('launch'));
		child.once('close', (code: number | null) => {
			if (finished) {
				return;
			}
			finished = true;
			cleanup();
			if (code !== 0) {
				const error = Buffer.concat(stderr).toString('utf8');
				if (/invalid connection option ["']require_auth["']/i.test(error)) {
					reject(new SchemaError('client-version'));
				} else if (/no password supplied|authentication failed|server requested .*authentication|server did not complete authentication/i.test(error)) {
					reject(new SchemaError('credentials'));
				} else {
					reject(new SchemaError('connection'));
				}
			} else {
				try {
					resolve(parseSchemaOutput(Buffer.concat(stdout).toString('utf8')));
				} catch (error) {
					reject(error);
				}
			}
		});
		signal.addEventListener('abort', abort, { once: true });
		if (signal.aborted) {
			abort();
		}
	});
}
