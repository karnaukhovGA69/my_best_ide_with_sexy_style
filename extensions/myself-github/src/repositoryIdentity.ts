/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';

export interface RepositoryIdentity {
	readonly owner: string;
	readonly name: string;
}

function validSegment(value: string, repository: boolean): boolean {
	return (repository ? /^[a-zA-Z0-9_.][a-zA-Z0-9_.-]*$/ : /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/).test(value)
		&& !['.', '..', '.git'].includes(value.toLowerCase())
		&& value.length <= 100
		&& !value.endsWith('.')
		&& !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value);
}

export function validateRepository(identity: RepositoryIdentity): void {
	if (!validSegment(identity.owner, false) || !validSegment(identity.name, true)) {
		throw new Error('Invalid repository identity');
	}
}

/** Only the selected root and its owner/name descendants are addressed. */
export function repositoryPath(root: string, identity: RepositoryIdentity): string {
	validateRepository(identity);
	if (!path.isAbsolute(root)) {
		throw new Error('Repository root must be absolute');
	}
	return path.join(root, identity.owner, identity.name);
}

export function repositoryCloneUrl(identity: RepositoryIdentity): string {
	validateRepository(identity);
	return `https://github.com/${identity.owner}/${identity.name}.git`;
}

/** Accept GitHub HTTPS/SSH remotes without credentials, query strings or fragments. */
export function matchesRepositoryRemote(remote: string, identity: RepositoryIdentity): boolean {
	validateRepository(identity);
	let repository: string;
	if (remote.startsWith('git@github.com:')) {
		repository = remote.slice('git@github.com:'.length);
	} else {
		let url: URL;
		try { url = new URL(remote); } catch { return false; }
		if (url.hostname !== 'github.com' || url.search || url.hash || url.password || url.port
			|| (url.protocol !== 'https:' && url.protocol !== 'ssh:')
			|| (url.protocol === 'https:' ? !!url.username : url.username !== 'git')) {
			return false;
		}
		repository = url.pathname.slice(1);
	}
	if (repository.endsWith('.git')) {
		repository = repository.slice(0, -4);
	}
	return repository.toLowerCase() === `${identity.owner}/${identity.name}`.toLowerCase();
}
