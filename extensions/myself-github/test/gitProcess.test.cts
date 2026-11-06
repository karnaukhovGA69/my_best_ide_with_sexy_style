/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GitProcess } = require('../out/gitProcess.js');

async function directory(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'myself git process '));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	return root;
}

test('reads an actual local origin without applying repository includes', async t => {
	const root = await directory(t);
	execFileSync('git', ['-c', 'init.templateDir=', 'init', '-q', root]);
	execFileSync('git', ['-C', root, 'config', 'remote.origin.url', 'git@github.com:example/project.git']);
	await fs.writeFile(path.join(root, 'extra.config'), '[remote "origin"]\nurl = https://attacker.invalid/wrong\n');
	execFileSync('git', ['-C', root, 'config', 'include.path', path.join(root, 'extra.config')]);
	assert.equal((await new GitProcess().origin(root, new AbortController().signal)).trim(), 'git@github.com:example/project.git');
});

test('redacts errors and rejects token-bearing or non-GitHub clone URLs before spawning', async t => {
	const root = await directory(t);
	const git = new GitProcess(path.join(root, 'missing-executable'));
	await assert.rejects(git.origin(root, new AbortController().signal), error => String(error) === 'Error: Git operation failed');
	for (const url of ['https://secret@github.com/example/project.git', 'http://github.com/example/project', 'https://attacker.invalid/example/project']) {
		await assert.rejects(git.clone(url, root, new AbortController().signal), /Invalid clone URL/);
	}
});

test('does not spawn for a pre-cancelled request', async t => {
	const root = await directory(t);
	const controller = new AbortController(); controller.abort();
	await assert.rejects(new GitProcess('missing-executable').origin(root, controller.signal), { name: 'AbortError' });
});

test('cancels a running process and waits for it to close', { skip: process.platform === 'win32' }, async t => {
	const root = await directory(t);
	const executable = path.join(root, 'slow-git');
	await fs.writeFile(executable, '#!/bin/sh\nexec sleep 30\n', { mode: 0o700 });
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 50);
	try { await assert.rejects(new GitProcess(executable).origin(root, controller.signal), { name: 'AbortError' }); }
	finally { clearTimeout(timer); }
});
