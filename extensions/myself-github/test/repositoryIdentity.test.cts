/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { repositoryPath, repositoryCloneUrl, matchesRepositoryRemote } = require('../out/repositoryIdentity.js');
const repository = { owner: 'example', name: 'project' };

test('addresses only root/owner/repository and constructs a fixed-host clone URL', () => {
	assert.equal(repositoryPath(path.resolve('synthetic-root'), repository), path.resolve('synthetic-root/example/project'));
	assert.equal(repositoryCloneUrl(repository), 'https://github.com/example/project.git');
});

test('rejects traversal, separators, device paths and option-like names', () => {
	for (const value of ['..', '.', '.git', '.GIT', '../escape', '/tmp', 'owner/name', 'owner\\name', '%2e%2e', '-c', 'name.', 'CON', 'nul.txt', 'lpt1', 'x\0y']) {
		assert.throws(() => repositoryPath(path.resolve('synthetic-root'), { owner: value, name: 'project' }));
		assert.throws(() => repositoryPath(path.resolve('synthetic-root'), { owner: 'example', name: value }));
	}
	assert.throws(() => repositoryPath('relative-root', repository));
});

test('matches the selected GitHub repository over HTTPS and SSH', () => {
	for (const remote of ['https://github.com/example/project.git', 'https://github.com/Example/Project', 'git@github.com:example/project.git', 'ssh://git@github.com/example/project.git']) {
		assert.equal(matchesRepositoryRemote(remote, repository), true);
	}
});

test('rejects other repositories, hosts, protocols, embedded credentials and URL suffixes', () => {
	for (const remote of ['https://github.com/example/other.git', 'https://github.com.attacker.invalid/example/project.git', 'https://token@github.com/example/project.git', 'ssh://user@github.com/example/project.git', 'http://github.com/example/project', 'file:///example/project', 'git@github.com:example/project.git?x', 'https://github.com/example/project#fragment', 'https://github.com:444/example/project', 'https://github.com/example/project/']) {
		assert.equal(matchesRepositoryRemote(remote, repository), false);
	}
});


test('accepts GitHub organization profile repositories without relaxing owner validation', () => {
	for (const name of ['.github', '.github-private', '_tools']) {
		const identity = { owner: 'example', name };
		assert.equal(repositoryPath(path.resolve('synthetic-root'), identity), path.resolve('synthetic-root', 'example', name));
		assert.equal(repositoryCloneUrl(identity), `https://github.com/example/${name}.git`);
		assert.equal(matchesRepositoryRemote(`git@github.com:example/${name}.git`, identity), true);
	}
	assert.throws(() => repositoryPath(path.resolve('synthetic-root'), { owner: '.github', name: 'project' }));
});
