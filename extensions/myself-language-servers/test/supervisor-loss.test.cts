/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FixturePaths, FixtureProcess, Message } from './fixtures/supervisor-process.cts';
import type { MarkerRead, RuntimeMarker } from './fixtures/supervisor-loss-marker.cts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { test } = require('node:test');
const { tryAcquireLease } = require('../src/lease.ts');
const { fixturePaths, identity, isLive, launchFixture, receive, rootPrefix, send, stageCaption, within } = require('./fixtures/supervisor-process.cts');
const { readRuntimeMarker, replaceRuntimeMarker, writeRuntimeMarker } = require('./fixtures/supervisor-loss-marker.cts');

type ObservedOwner = Readonly<{ fixture: FixtureProcess; generation: string }>;

async function killOwned(fixture: FixtureProcess): Promise<void> {
	if (isLive(fixture)) {
		fixture.child.kill('SIGKILL');
	}
	await within(fixture.exited, 'own fixture to exit');
}

async function ask(fixture: FixtureProcess, command: Message, event: string): Promise<Message> {
	const [reply] = await Promise.all([receive(fixture.child, event), send(fixture.child, command)]);
	return reply;
}

async function underLease<T>(paths: FixturePaths, operation: () => Promise<T>): Promise<T> {
	const lease = await tryAcquireLease(paths.lease);
	assert.ok(lease, 'test owner must acquire lease before examining marker');
	try {
		return await operation();
	} finally {
		await lease.close();
	}
}

async function clearAfterObservedExit(paths: FixturePaths, owner: ObservedOwner): Promise<boolean> {
	if (isLive(owner.fixture)) {
		return false;
	}
	const outcome = await within(owner.fixture.exited, 'owned synthetic server to exit');
	if (!('code' in outcome) || outcome.code !== 0 || outcome.signal !== null) {
		return false;
	}
	return underLease(paths, async () => {
		const marker = await readRuntimeMarker(paths.runtimeMarker);
		if (typeof marker === 'string' || marker.generation !== owner.generation) {
			return false;
		}
		await unlink(paths.runtimeMarker);
		return true;
	});
}

for (const scenario of ['starting', 'running', 'unknown', 'stale and invalid proof', 'marker already exists'] as const) {
	test('Remove fails closed after supervisor loss: ' + scenario, {
		timeout: 28_000,
		skip: process.platform !== 'darwin' || process.arch !== 'arm64',
	}, async () => {
		const runtime = await realpath(process.execPath);
		const root = await mkdtemp(join(await realpath('/tmp'), rootPrefix));
		const id = randomUUID();
		const paths = fixturePaths(root, id);
		const payload = join(paths.stage, 'fixture.txt');
		const fixtures: FixtureProcess[] = [];

		function launch(role: 'loss-supervisor' | 'surviving-server' | 'remove'): FixtureProcess {
			const fixture = launchFixture(runtime, role, root, id);
			fixtures.push(fixture);
			return fixture;
		}

		async function tryRemove(expected: Record<string, unknown>): Promise<void> {
			const client = launch('remove');
			const reply = await receive(client.child, 'result');
			assert.deepEqual(await within(client.exited, 'independent Remove client exit'), { code: 0, signal: null });
			assert.deepEqual(reply, { type: 'result', ...expected });
		}

		async function proveAlive(server: FixtureProcess): Promise<void> {
			const nonce = randomBytes(16).toString('hex');
			const reply = await ask(server, { type: 'probe', nonce }, 'probe-reply');
			assert.deepEqual(reply, { type: 'probe-reply', nonce });
		}

		try {
			await mkdir(paths.locks, { recursive: true, mode: 0o700 });
			await mkdir(paths.stage, { recursive: true, mode: 0o700 });
			await writeFile(payload, stageCaption, { flag: 'wx', mode: 0o600 });

			if (scenario === 'marker already exists') {
				const existing: RuntimeMarker = { version: 1, generation: randomUUID(), state: 'starting' };
				await underLease(paths, () => writeRuntimeMarker(paths.runtimeMarker, existing));
				const refusingSupervisor = launch('loss-supervisor');
				assert.deepEqual(await receive(refusingSupervisor.child, 'start-refused'), { type: 'start-refused' });
				assert.deepEqual(await within(refusingSupervisor.exited, 'refused supervisor exit'), { code: 0, signal: null });
				const inode = identity(await lstat(paths.lease, { bigint: true }));
				await tryRemove({ status: 'ownership-unconfirmed', state: 'starting', inode });
				assert.deepEqual(await readRuntimeMarker(paths.runtimeMarker), existing);
				assert.equal(await readFile(payload, 'utf8'), stageCaption);
				return;
			}

			const supervisor = launch('loss-supervisor');
			const marked = await receive(supervisor.child, 'marked');
			const starting: MarkerRead = await readRuntimeMarker(paths.runtimeMarker);
			const inode = identity(await lstat(paths.lease, { bigint: true }));
			assert.ok(typeof starting !== 'string');
			assert.equal(starting.state, 'starting');
			assert.deepEqual(marked.marker, starting);
			assert.deepEqual(marked.inode, inode);
			await tryRemove({ status: 'busy', inode });

			const server = launch('surviving-server');
			const owner: ObservedOwner = Object.freeze({ fixture: server, generation: starting.generation });
			await receive(server.child, 'ready');
			const state = scenario === 'stale and invalid proof' ? 'running' : scenario;
			const marker: RuntimeMarker = { ...starting, state };
			if (state !== 'starting') {
				const recorded = await ask(supervisor, { type: 'record-state', generation: owner.generation, state }, 'recorded');
				assert.deepEqual(recorded.marker, marker);
			}

			assert.ok(isLive(supervisor));
			await killOwned(supervisor);
			assert.deepEqual(await supervisor.exited, { code: null, signal: 'SIGKILL' });
			await proveAlive(server);

			// Remove acquires the now-free lease and checks the surviving marker under that lease.
			await tryRemove({ status: 'ownership-unconfirmed', state, inode });
			assert.deepEqual(await readRuntimeMarker(paths.runtimeMarker), marker);
			assert.equal(await readFile(payload, 'utf8'), stageCaption);
			assert.equal(await clearAfterObservedExit(paths, owner), false);
			await proveAlive(server);

			if (scenario === 'stale and invalid proof') {
				const newer: RuntimeMarker = { ...marker, generation: randomUUID() };
				await underLease(paths, () => replaceRuntimeMarker(paths.runtimeMarker, newer));
				await send(server.child, { type: 'stop' });
				assert.deepEqual(await within(server.exited, 'owned server exit'), { code: 0, signal: null });
				assert.equal(await clearAfterObservedExit(paths, owner), false);
				assert.deepEqual(await readRuntimeMarker(paths.runtimeMarker), newer);
				await tryRemove({ status: 'ownership-unconfirmed', state: 'running', inode });

				await underLease(paths, () => writeFile(paths.runtimeMarker, '{"version":1,'));
				await tryRemove({ status: 'ownership-unconfirmed', state: 'invalid', inode });
				await underLease(paths, () => writeFile(paths.runtimeMarker, Buffer.alloc(513)));
				await tryRemove({ status: 'ownership-unconfirmed', state: 'invalid', inode });
				await underLease(paths, async () => {
					await unlink(paths.runtimeMarker);
					await symlink(join(paths.locks, 'missing-fixture-marker'), paths.runtimeMarker);
				});
				await tryRemove({ status: 'ownership-unconfirmed', state: 'invalid', inode });
				assert.equal(await readFile(payload, 'utf8'), stageCaption);
				return;
			}

			await send(server.child, { type: 'stop' });
			assert.deepEqual(await within(server.exited, 'owned server exit'), { code: 0, signal: null });
			await tryRemove({ status: 'ownership-unconfirmed', state, inode });
			assert.equal(await clearAfterObservedExit(paths, owner), true);
			assert.equal(await readRuntimeMarker(paths.runtimeMarker), 'absent');
			await tryRemove({ status: 'removed', inode });
			assert.deepEqual(identity(await lstat(paths.lease, { bigint: true })), inode);
			await assert.rejects(lstat(paths.stage), { code: 'ENOENT' });
		} finally {
			const cleanups = await Promise.allSettled(fixtures.map(killOwned));
			for (const outcome of cleanups) {
				if (outcome.status === 'rejected') {
					throw outcome.reason; // Keep the scratch area when an owned fixture couldn't be reaped.
				}
			}
			await rm(root, { recursive: true });
		}
	});
}
