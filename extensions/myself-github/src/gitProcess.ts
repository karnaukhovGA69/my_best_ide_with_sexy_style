/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'node:child_process';
import { RepositoryGit } from './localRepositories';

export class GitOperationError extends Error {
	constructor(readonly exitCode: number | null) {
		// Git stderr can contain credentials and private URLs. Never surface it verbatim.
		super('Git operation failed');
	}
}

export class GitProcess implements RepositoryGit {
	constructor(private readonly executable = 'git') { }

	async clone(url: string, directory: string, signal: AbortSignal): Promise<void> {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
			throw new Error('Invalid clone URL');
		}
		await this.run(['clone', '--', url, directory], directory, signal, false);
	}

	async origin(directory: string, signal: AbortSignal): Promise<string> {
		return this.run(['config', '--local', '--no-includes', '--get', 'remote.origin.url'], directory, signal, true);
	}

	private run(args: string[], cwd: string, signal: AbortSignal, capture: boolean): Promise<string> {
		signal.throwIfAborted();
		const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
		// Do not inherit overrides that redirect repository access outside the selected directory.
		for (const key of Object.keys(env)) {
			if (/^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG|CONFIG_PARAMETERS|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/.test(key)) {
				delete env[key];
			}
		}
		return new Promise((resolve, reject) => {
			const child = spawn(this.executable, args, { cwd, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'ignore'] });
			let output = '';
			let overflow = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const kill = (force: boolean) => {
				if (!child.pid) { return; }
				if (process.platform === 'win32') {
					const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
					killer.on('error', () => child.kill());
				} else {
					try { process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); } catch { /* Process already exited. */ }
				}
			};
			const cancel = () => {
				kill(false);
				timer ??= setTimeout(() => kill(true), 2000);
			};
			signal.addEventListener('abort', cancel, { once: true });
			const clean = () => {
				signal.removeEventListener('abort', cancel);
				if (timer) { clearTimeout(timer); }
			};
			child.stdout.on('data', (data: Buffer) => {
				if (!capture) { return; }
				if (Buffer.byteLength(output) + data.byteLength > 16384) { overflow = true; kill(true); return; }
				output += data.toString('utf8');
			});
			child.on('error', () => { clean(); reject(new GitOperationError(null)); });
			child.on('close', code => {
				clean();
				if (signal.aborted) { reject(signal.reason); }
				else if (code !== 0 || overflow) { reject(new GitOperationError(code)); }
				else { resolve(output); }
			});
			if (signal.aborted) { cancel(); }
		});
	}
}
