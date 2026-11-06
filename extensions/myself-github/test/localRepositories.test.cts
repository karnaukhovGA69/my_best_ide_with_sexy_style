/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LocalRepositories, canonicalRepositoryRoot } = require('../out/localRepositories.js');
const repository = { owner: 'example', name: 'project' };
const remote = 'https://github.com/example/project.git';

async function fixture(t) {
	const root = await canonicalRepositoryRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'myself-repository-test-')));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	let clones = 0;
	const git = {
		async clone(url, directory) { clones++; assert.equal(url, remote); await fs.mkdir(path.join(directory, '.git')); await fs.writeFile(path.join(directory, '.git/config'), 'synthetic config'); },
		async origin() { return remote; }
	};
	return { root, git, clones: () => clones, service: new LocalRepositories(root, git), target: path.join(root, 'example/project') };
}

test('clones once and reopens a verified copy without scanning sibling folders', async t => {
	const f = await fixture(t);
	await fs.mkdir(path.join(f.root, 'unrelated'), { mode: 0o000 });
	const signal = new AbortController().signal;
	assert.equal(await f.service.prepare(repository, signal), f.target);
	assert.equal(await f.service.prepare(repository, signal), f.target);
	assert.equal(f.clones(), 1);
	assert.deepEqual(await fs.readdir(path.dirname(f.target)), ['project']);
});

test('refuses unrelated directories without overwriting their contents', async t => {
	const f = await fixture(t);
	await fs.mkdir(f.target, { recursive: true });
	await fs.writeFile(path.join(f.target, 'keep.txt'), 'keep');
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'conflict' });
	assert.equal(await fs.readFile(path.join(f.target, 'keep.txt'), 'utf8'), 'keep');
	assert.equal(f.clones(), 0);
});

test('refuses a different origin', async t => {
	const f = await fixture(t);
	await f.service.prepare(repository, new AbortController().signal);
	f.git.origin = async () => 'git@github.com:other/repository.git';
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'conflict' });
	assert.equal(f.clones(), 1);
});

for (const segment of ['owner', 'target', 'git']) {
	test(`refuses ${segment} symlink escapes`, async t => {
		const f = await fixture(t);
		const outside = await canonicalRepositoryRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'myself-outside-test-')));
		t.after(() => fs.rm(outside, { recursive: true, force: true }));
		const link = segment === 'owner' ? path.dirname(f.target) : segment === 'target' ? f.target : path.join(f.target, '.git');
		await fs.mkdir(path.dirname(link), { recursive: true });
		await fs.symlink(outside, link);
		await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'unsafePath' });
		assert.deepEqual(await fs.readdir(outside), []);
		assert.equal(f.clones(), 0);
	});
}

test('cancellation keeps an incomplete clone marked and never returns it as openable', async t => {
	const f = await fixture(t);
	const controller = new AbortController();
	const clone = f.git.clone;
	f.git.clone = async (url, directory) => { await clone(url, directory); controller.abort(); };
	await assert.rejects(f.service.prepare(repository, controller.signal), { name: 'AbortError' });
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'incomplete' });
	assert.equal(f.clones(), 1);
});

test('clone failure preserves partial data without opening or retrying over it', async t => {
	const f = await fixture(t);
	f.git.clone = async (_url, directory) => { await fs.writeFile(path.join(directory, 'partial'), 'partial'); throw new Error('synthetic failure'); };
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), /synthetic failure/);
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'incomplete' });
	assert.equal(await fs.readFile(path.join(f.target, 'partial'), 'utf8'), 'partial');
});

test('pre-cancelled operations create no owner directory', async t => {
	const f = await fixture(t);
	const controller = new AbortController(); controller.abort();
	await assert.rejects(f.service.prepare(repository, controller.signal), { name: 'AbortError' });
	assert.deepEqual(await fs.readdir(f.root), []);
});

test('concurrent requests cannot clone the same destination twice', async t => {
	const f = await fixture(t);
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	const clone = f.git.clone;
	f.git.clone = async (url, directory) => { await gate; await clone(url, directory); };
	const first = f.service.prepare(repository, new AbortController().signal);
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'busy' });
	release();
	assert.equal(await first, f.target);
	assert.equal(f.clones(), 1);
});

test('refuses a symlinked Git config without reading its remote', async t => {
	const f = await fixture(t);
	await f.service.prepare(repository, new AbortController().signal);
	const config = path.join(f.target, '.git/config');
	await fs.unlink(config);
	await fs.writeFile(path.join(f.root, 'outside-config'), 'do not read');
	await fs.symlink(path.join(f.root, 'outside-config'), config);
	f.git.origin = async () => { throw new Error('Unexpected config read'); };
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'unsafePath' });
});

test('detects replacement of the repository while origin is being checked', async t => {
	const f = await fixture(t);
	await f.service.prepare(repository, new AbortController().signal);
	f.git.origin = async () => {
		await fs.rename(f.target, `${f.target}-old`);
		await fs.mkdir(path.join(f.target, '.git'), { recursive: true });
		await fs.writeFile(path.join(f.target, '.git/config'), 'replacement');
		return remote;
	};
	await assert.rejects(f.service.prepare(repository, new AbortController().signal), { reason: 'unsafePath' });
});
