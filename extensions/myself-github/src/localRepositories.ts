/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { matchesRepositoryRemote, repositoryCloneUrl, RepositoryIdentity, repositoryPath } from './repositoryIdentity';

export interface RepositoryGit {
	/** Clone into the already reserved, empty directory. No shell or token-bearing URLs. */
	clone(url: string, directory: string, signal: AbortSignal): Promise<void>;
	/** Read only the local origin configuration, without following configuration includes. */
	origin(directory: string, signal: AbortSignal): Promise<string>;
}

export type RepositoryFailure = 'unsafePath' | 'conflict' | 'incomplete' | 'busy';

export class RepositoryError extends Error {
	constructor(readonly reason: RepositoryFailure) {
		super(reason);
	}
}

async function statIfPresent(location: string) {
	try { return await fs.lstat(location); } catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return undefined;
		}
		throw error;
	}
}

async function safeDirectory(location: string) {
	const stat = await fs.lstat(location);
	if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(location) !== location) {
		throw new RepositoryError('unsafePath');
	}
	return stat;
}

/** Select once through a local directory picker; persist this canonical path, not a symlink alias. */
export async function canonicalRepositoryRoot(location: string): Promise<string> {
	if (!path.isAbsolute(location)) {
		throw new RepositoryError('unsafePath');
	}
	const root = await fs.realpath(location);
	await safeDirectory(root);
	return root;
}

export class LocalRepositories {
	private readonly active = new Set<string>();

	constructor(private readonly root: string, private readonly git: RepositoryGit) { }

	/** Returns an openable directory only after existing-origin verification or successful clone. */
	async prepare(repository: RepositoryIdentity, signal: AbortSignal): Promise<string> {
		const target = repositoryPath(this.root, repository);
		if (this.active.has(target.toLowerCase())) {
			throw new RepositoryError('busy');
		}
		this.active.add(target.toLowerCase());
		try {
			signal.throwIfAborted();
			const rootStat = await safeDirectory(this.root);
			const owner = path.dirname(target);
			try { await fs.mkdir(owner); } catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'EEXIST') { throw error; }
			}
			const ownerStat = await safeDirectory(owner);
			const assertParents = async () => {
				const rootNow = await safeDirectory(this.root);
				const ownerNow = await safeDirectory(owner);
				if (rootNow.dev !== rootStat.dev || rootNow.ino !== rootStat.ino || ownerNow.dev !== ownerStat.dev || ownerNow.ino !== ownerStat.ino) {
					throw new RepositoryError('unsafePath');
				}
			};
			// A failed clone is never mistaken for a usable repository, even if it already has an origin.
			const marker = path.join(owner, `.${repository.name}.myself-incomplete`);
			if (await statIfPresent(marker)) { throw new RepositoryError('incomplete'); }
			if (await statIfPresent(target)) {
				await this.verify(target, repository, signal);
				await assertParents();
				signal.throwIfAborted();
				return target;
			}
			await assertParents();
			signal.throwIfAborted();
			// Exclusive directory creation refuses concurrent writers, including another IDE window.
			try { await fs.mkdir(target); } catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'EEXIST') { throw new RepositoryError('conflict'); }
				throw error;
			}
			const targetStat = await safeDirectory(target);
			await fs.writeFile(marker, 'Incomplete clone. Do not open automatically.\n', { flag: 'wx', mode: 0o600 });
			await assertParents();
			signal.throwIfAborted();
			await this.git.clone(repositoryCloneUrl(repository), target, signal);
			signal.throwIfAborted();
			await assertParents();
			const targetNow = await safeDirectory(target);
			if (targetNow.dev !== targetStat.dev || targetNow.ino !== targetStat.ino) { throw new RepositoryError('unsafePath'); }
			await this.verify(target, repository, signal);
			signal.throwIfAborted();
			await fs.unlink(marker);
			return target;
		} finally {
			this.active.delete(target.toLowerCase());
		}
	}

	private async verify(target: string, repository: RepositoryIdentity, signal: AbortSignal): Promise<void> {
		const targetBefore = await safeDirectory(target);
		const gitDirectory = path.join(target, '.git');
		if (!await statIfPresent(gitDirectory)) { throw new RepositoryError('conflict'); }
		const gitBefore = await safeDirectory(gitDirectory);
		const config = await fs.lstat(path.join(gitDirectory, 'config'));
		if (!config.isFile() || config.isSymbolicLink()) { throw new RepositoryError('unsafePath'); }
		signal.throwIfAborted();
		if (!matchesRepositoryRemote((await this.git.origin(target, signal)).trim(), repository)) {
			throw new RepositoryError('conflict');
		}
		const targetAfter = await safeDirectory(target);
		const gitAfter = await safeDirectory(gitDirectory);
		if (targetBefore.dev !== targetAfter.dev || targetBefore.ino !== targetAfter.ino || gitBefore.dev !== gitAfter.dev || gitBefore.ino !== gitAfter.ino) {
			throw new RepositoryError('unsafePath');
		}
	}
}
