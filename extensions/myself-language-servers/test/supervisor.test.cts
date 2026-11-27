/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { test } = require('node:test');
const { fixturePaths, identity, isLive, launchFixture, receive, rootPrefix, send, stageCaption, within } = require('./fixtures/supervisor-process.cts');

type Fixture = ReturnType<typeof launchFixture>;

async function killOwned(fixture: Fixture): Promise<void> {
	if (isLive(fixture)) {
		fixture.child.kill('SIGKILL');
	}
	await within(fixture.exited, 'owned fixture to exit');
}

async function shutdownSupervisor(fixture: Fixture): Promise<void> {
	if (isLive(fixture) && fixture.child.connected) {
		await send(fixture.child, { type: 'abort' }).catch(() => {
			if (fixture.child.connected) {
				fixture.child.disconnect();
			}
		});
	}
	try {
		assert.deepEqual(await within(fixture.exited, 'supervisor cleanup', 7_000), { code: 0, signal: null });
	} catch (error) {
		await killOwned(fixture);
		throw error; // A failed reap is not enough evidence to discard the fixture namespace.
	}
}

test('an independent supervisor keeps the per-package lease after coordinator SIGKILL', {
	timeout: 30_000,
	skip: process.platform !== 'darwin' || process.arch !== 'arm64',
}, async () => {
	const runtime = await realpath(process.execPath);
	const root = await mkdtemp(join(await realpath('/tmp'), rootPrefix));
	const id = randomUUID();
	const otherId = randomUUID();
	const paths = fixturePaths(root, id);
	const other = fixturePaths(root, otherId);
	const marker = join(paths.stage, 'fixture.txt');
	const legacyMarker = join(root, 'managed', id, 'legacy.txt');
	let coordinator: Fixture | undefined;
	let supervisor: Fixture | undefined;

	async function checkRemove(packageId: string) {
		const client = launchFixture(runtime, 'remove', root, packageId);
		try {
			const reply = await receive(client.child, 'result');
			assert.deepEqual(await within(client.exited, 'Remove client exit'), { code: 0, signal: null });
			return reply;
		} finally {
			await killOwned(client);
		}
	}

	async function ask(fixture: Fixture, command: { type: string; nonce?: string }, event: string) {
		const [reply] = await Promise.all([receive(fixture.child, event), send(fixture.child, command)]);
		return reply;
	}

	async function assertAlive(fixture: Fixture) {
		const nonce = randomBytes(16).toString('hex');
		const proof = await ask(fixture, { type: 'probe', nonce }, 'probe-reply');
		assert.equal(proof.nonce, nonce);
	}

	try {
		await mkdir(paths.store, { mode: 0o700 });
		await mkdir(paths.locks, { mode: 0o700 });
		await mkdir(paths.packages, { mode: 0o700 });
		await mkdir(paths.stage, { mode: 0o700 });
		await mkdir(other.stage, { mode: 0o700 });
		await mkdir(join(root, 'managed', id), { recursive: true, mode: 0o700 });
		await writeFile(marker, stageCaption, { flag: 'wx', mode: 0o600 });
		await writeFile(join(other.stage, 'fixture.txt'), stageCaption, { flag: 'wx', mode: 0o600 });
		await writeFile(legacyMarker, 'synthetic legacy entry', { flag: 'wx', mode: 0o600 });

		coordinator = launchFixture(runtime, 'coordinator', root, id);
		await receive(coordinator.child, 'start-requested');
		supervisor = launchFixture(runtime, 'supervisor', root, id);
		const ready = await receive(supervisor.child, 'ready');
		const lockIdentity = identity(await lstat(paths.lease, { bigint: true }));
		assert.equal(ready.fdClosed, true);
		assert.deepEqual(ready.inherited, lockIdentity);
		assert.deepEqual(ready.leaseIdentity, lockIdentity);

		assert.ok(isLive(coordinator));
		await killOwned(coordinator);
		assert.deepEqual(await coordinator.exited, { code: null, signal: 'SIGKILL' });
		await assertAlive(supervisor);

		const busy = { type: 'result', status: 'busy', inode: lockIdentity };
		assert.deepEqual(await checkRemove(id), busy);
		assert.equal(await readFile(marker, 'utf8'), stageCaption);
		await assertAlive(supervisor);

		assert.equal((await checkRemove(otherId)).status, 'removed');
		await assert.rejects(lstat(other.stage), { code: 'ENOENT' });
		assert.equal(await readFile(marker, 'utf8'), stageCaption);

		const stopped = await ask(supervisor, { type: 'stop' }, 'reaped');
		assert.deepEqual(stopped.outcome, { code: 0, signal: null });
		assert.deepEqual(await checkRemove(id), busy);
		await ask(supervisor, { type: 'release' }, 'released');
		assert.deepEqual(await within(supervisor.exited, 'supervisor exit'), { code: 0, signal: null });

		assert.deepEqual(await checkRemove(id), { type: 'result', status: 'removed', inode: lockIdentity });
		await assert.rejects(lstat(paths.stage), { code: 'ENOENT' });
		assert.deepEqual(identity(await lstat(paths.lease, { bigint: true })), lockIdentity);
		assert.equal(await readFile(legacyMarker, 'utf8'), 'synthetic legacy entry');
	} finally {
		try {
			if (coordinator) {
				await killOwned(coordinator);
			}
		} finally {
			if (supervisor) {
				await shutdownSupervisor(supervisor);
			}
		}
		await rm(root, { recursive: true });
	}
});
