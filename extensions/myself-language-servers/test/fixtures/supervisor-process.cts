/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ChildProcess } from 'node:child_process';
import type { FileHandle } from 'node:fs/promises';
import type { RuntimeMarker } from './supervisor-loss-marker.cts';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { on, once } = require('node:events');
const { closeSync, fstatSync } = require('node:fs');
const { lstat, readFile, realpath, rm } = require('node:fs/promises');
const { basename, dirname, join } = require('node:path');
const { tryAcquireLease } = require('../../src/lease.ts');
const { readRuntimeMarker, replaceRuntimeMarker, writeRuntimeMarker } = require('./supervisor-loss-marker.cts');

type Role = 'coordinator' | 'supervisor' | 'server' | 'loss-supervisor' | 'surviving-server' | 'remove';
type Exit = { code: number | null; signal: NodeJS.Signals | null } | { error: string };
type FixtureProcess = { child: ChildProcess; exited: Promise<Exit> };
type Message = { type: string; nonce?: string; [key: string]: unknown };

const rootPrefix = 'nerded-lsp-supervisor-fixture-';
const stageCaption = 'synthetic staged package';
const messageTimeout = 4_000;

function fixturePaths(root: string, id: string) {
	const store = join(root, 'runnable-fixture-only');
	return {
		store,
		locks: join(store, 'locks'),
		packages: join(store, 'packages'),
		lease: join(store, 'locks', id + '.lock'),
		runtimeMarker: join(store, 'locks', id + '.runtime.json'),
		stage: join(store, 'packages', id),
	};
}

function identity(stat: { dev: bigint; ino: bigint }) {
	return { dev: String(stat.dev), ino: String(stat.ino) };
}

async function fixtureEnvironment(root: string, id: string) {
	assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	assert.equal(dirname(root), await realpath('/tmp'));
	assert.ok(basename(root).startsWith(rootPrefix));
	assert.equal(root, await realpath(root));
	const paths = fixturePaths(root, id);
	for (const path of [root, paths.store, paths.locks, paths.packages]) {
		const info = await lstat(path);
		assert.ok(info.isDirectory() && info.uid === process.getuid?.() && (info.mode & 0o077) === 0);
	}
	return paths;
}

function launchFixture(runtime: string, role: Role, root: string, id: string, lease?: FileHandle): FixtureProcess {
	const child: ChildProcess = spawn(runtime, [__filename, role, root, id], {
		cwd: root,
		// Keep fixture subprocesses in Node mode when process.execPath is the packaged Electron binary.
		env: process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {},
		shell: false,
		stdio: ['ignore', 'ignore', 'inherit', ...(lease ? [lease.fd] : []), 'ipc'],
	});
	const exited = new Promise<Exit>(resolve => {
		child.on('error', error => {
			if (child.pid === undefined) {
				resolve({ error: error.message });
			}
		});
		child.once('exit', (code, signal) => resolve({ code, signal }));
	});
	return { child, exited };
}

async function receive(emitter: NodeJS.EventEmitter, type: string): Promise<Message> {
	const [message] = await once(emitter, 'message', { signal: AbortSignal.timeout(messageTimeout) });
	assert.equal(message?.type, type);
	return message;
}

function send(emitter: Pick<ChildProcess, 'send'> | NodeJS.Process, message: Message): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!emitter.send) {
			throw new Error('Fixture IPC is unavailable');
		}
		emitter.send(message, undefined, undefined, error => error ? reject(error) : resolve());
	});
}

async function within<T>(promise: Promise<T>, description: string, ms = messageTimeout): Promise<T> {
	let deadline: NodeJS.Timeout | undefined;
	try {
		return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
			deadline = setTimeout(() => reject(new Error('Timed out waiting for ' + description)), ms);
		})]);
	} finally {
		clearTimeout(deadline);
	}
}

function isLive(fixture: FixtureProcess): boolean {
	return fixture.child.pid !== undefined && fixture.child.exitCode === null && fixture.child.signalCode === null;
}

async function endServer(server: FixtureProcess): Promise<Exit> {
	if (isLive(server)) {
		try {
			await send(server.child, { type: 'stop' });
			return await within(server.exited, 'fixture server to stop', 1_000);
		} catch {
			if (isLive(server)) {
				server.child.kill('SIGKILL');
			}
		}
	}
	return within(server.exited, 'fixture server exit');
}

async function serve(inheritLease: boolean): Promise<void> {
	const commands = on(process, 'message', { close: ['disconnect'], signal: AbortSignal.timeout(18_000) });
	if (inheritLease) {
		const fd = 3;
		const inherited = identity(fstatSync(fd, { bigint: true }));
		closeSync(fd);
		assert.throws(() => fstatSync(fd), { code: 'EBADF' });
		await send(process, { type: 'ready', inherited, fdClosed: true });
	} else {
		await send(process, { type: 'ready' });
	}
	for await (const [message] of commands) {
		if (message.type === 'stop') {
			return;
		}
		assert.equal(message.type, 'probe');
		assert.match(message.nonce, /^[0-9a-f]{32}$/);
		await send(process, { type: 'probe-reply', nonce: message.nonce });
	}
}

async function supervise(root: string, id: string, paths: ReturnType<typeof fixturePaths>): Promise<void> {
	const lease = await tryAcquireLease(paths.lease);
	assert.ok(lease, 'supervisor must acquire its own kernel lease');
	const control = on(process, 'message', { close: ['disconnect'], signal: AbortSignal.timeout(18_000) });
	let server: FixtureProcess | undefined;
	let reaped = false;
	let releaseRequested = false;
	try {
		const leaseIdentity = identity(await lease.stat({ bigint: true }));
		server = launchFixture(process.execPath, 'server', root, id, lease);
		const ready = await receive(server.child, 'ready');
		assert.equal(ready.fdClosed, true);
		assert.deepEqual(ready.inherited, leaseIdentity);
		await send(process, { type: 'ready', inherited: ready.inherited, leaseIdentity, fdClosed: ready.fdClosed });

		for await (const [message] of control) {
			if (message.type === 'abort') {
				break;
			}
			if (message.type === 'release') {
				assert.ok(reaped, 'cannot release until the child actually exits');
				releaseRequested = true;
				break;
			}
			if (message.type === 'stop') {
				assert.equal(reaped, false);
				await send(server.child, { type: 'stop' });
				const outcome = await within(server.exited, 'fixture server exit');
				assert.deepEqual(outcome, { code: 0, signal: null });
				reaped = true;
				await send(process, { type: 'reaped', outcome });
				continue;
			}
			assert.equal(message.type, 'probe');
			assert.equal(reaped, false);
			const [proof] = await Promise.all([
				receive(server.child, 'probe-reply'),
				send(server.child, { type: 'probe', nonce: message.nonce }),
			]);
			await send(process, proof);
		}
	} finally {
		try {
			if (server && !reaped) {
				const outcome = await endServer(server);
				assert.ok(!('error' in outcome) || server.child.pid === undefined);
			}
			await lease.close();
		} finally {
			await control.return();
		}
	}
	if (releaseRequested) {
		await send(process, { type: 'released' });
	}
}

async function superviseLoss(paths: ReturnType<typeof fixturePaths>): Promise<void> {
	const lease = await tryAcquireLease(paths.lease);
	assert.ok(lease, 'loss supervisor must hold its own lease');
	const control = on(process, 'message', { close: ['disconnect'], signal: AbortSignal.timeout(18_000) });
	const marker: RuntimeMarker = { version: 1, generation: randomUUID(), state: 'starting' };
	try {
		try {
			await writeRuntimeMarker(paths.runtimeMarker, marker);
		} catch {
			await send(process, { type: 'start-refused' });
			return;
		}
		const inode = identity(await lease.stat({ bigint: true }));
		await send(process, { type: 'marked', marker, inode });
		for await (const [message] of control) {
			assert.equal(message.type, 'record-state');
			assert.equal(message.generation, marker.generation);
			assert.ok(message.state === 'running' || message.state === 'unknown');
			marker.state = message.state;
			await replaceRuntimeMarker(paths.runtimeMarker, marker);
			await send(process, { type: 'recorded', marker });
		}
	} finally {
		await lease.close();
		await control.return();
	}
}

async function remove(paths: ReturnType<typeof fixturePaths>): Promise<void> {
	const lease = await tryAcquireLease(paths.lease);
	if (!lease) {
		await send(process, { type: 'result', status: 'busy', inode: identity(await lstat(paths.lease, { bigint: true })) });
		return;
	}
	try {
		const ownership = await readRuntimeMarker(paths.runtimeMarker);
		const inode = identity(await lease.stat({ bigint: true }));
		if (ownership !== 'absent') {
			await send(process, { type: 'result', status: 'ownership-unconfirmed', state: typeof ownership === 'string' ? ownership : ownership.state, inode });
			return;
		}

		const stage = await lstat(paths.stage);
		assert.ok(stage.isDirectory() && stage.uid === process.getuid?.() && (stage.mode & 0o077) === 0);
		const marker = join(paths.stage, 'fixture.txt');
		assert.ok((await lstat(marker)).isFile());
		assert.equal(await readFile(marker, 'utf8'), stageCaption);
		await rm(paths.stage, { recursive: true });
		await send(process, { type: 'result', status: 'removed', inode });
	} finally {
		await lease.close();
	}
}

async function main(): Promise<void> {
	const [role, root, id] = process.argv.slice(2);
	assert.equal(process.argv.length, 5);
	const paths = await fixtureEnvironment(root, id);
	switch (role) {
		case 'coordinator': {
			await Promise.all([
				once(process, 'disconnect', { signal: AbortSignal.timeout(18_000) }),
				send(process, { type: 'start-requested' }),
			]);
			return;
		}
		case 'supervisor': return supervise(root, id, paths);
		case 'server': return serve(true);
		case 'loss-supervisor': return superviseLoss(paths);
		case 'surviving-server': return serve(false);
		case 'remove': return remove(paths);
		default: assert.fail('Unknown fixture role');
	}
}

if (require.main === module) {
	assert.equal(process.platform, 'darwin');
	assert.equal(process.arch, 'arm64');
	main().catch(error => {
		console.error(error);
		process.exitCode = 1;
	}).finally(() => {
		if (process.connected) {
			process.disconnect?.();
		}
	});
}

export type FixturePaths = ReturnType<typeof fixturePaths>;
export type { FixtureProcess, Message };

module.exports = { fixturePaths, identity, isLive, launchFixture, receive, rootPrefix, send, stageCaption, within };
