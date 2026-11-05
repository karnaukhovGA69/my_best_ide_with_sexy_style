/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { lstat, mkdir, mkdtemp, readdir, rm, symlink, truncate, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { diagnosticLogSessionsMaxBytes, pruneDiagnosticLogSessions } from '../../node/diagnosticLogSessionRetention.js';

suite('Diagnostic log session retention', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const now = Date.UTC(2026, 10, 6, 12);
	const day = 86400000;
	const current = '20261106T120000';
	let root: string;
	let logs: string;

	setup(async () => {
		root = await mkdtemp(join(tmpdir(), 'myself-log-sessions-'));
		logs = join(root, 'logs');
		await mkdir(logs);
		await session(current, 0, now);
	});
	teardown(async () => { await rm(root, { recursive: true, force: true }); });

	async function session(name: string, bytes = 1, modified = now - 2 * day): Promise<void> {
		const directory = join(logs, name);
		const nested = join(directory, 'window1');
		await mkdir(nested, { recursive: true });
		const file = join(nested, 'renderer.log');
		await writeFile(file, '');
		await truncate(file, bytes);
		for (const path of [file, nested, directory]) {
			await utimes(path, modified / 1000, modified / 1000);
		}
	}

	const clean = () => pruneDiagnosticLogSessions(join(logs, current), now);

	test('deletes oldest archived sessions to meet the combined byte budget', async () => {
		await session('20261103T120000', diagnosticLogSessionsMaxBytes * 0.6);
		await session('20261104T120000', diagnosticLogSessionsMaxBytes * 0.6);
		const result = await clean();
		assert.deepStrictEqual({ files: await readdir(logs), removed: result.removed, bytes: result.remainingBytes }, {
			files: ['20261104T120000', current], removed: ['20261103T120000'], bytes: diagnosticLogSessionsMaxBytes * 0.6
		});
	});

	test('counts nested current logs in the budget without deleting or truncating them', async () => {
		await session(current, diagnosticLogSessionsMaxBytes + 1, now);
		await session('20261104T120000', 1);
		const result = await clean();
		assert.deepStrictEqual({ removed: result.removed, bytes: result.remainingBytes, size: (await lstat(join(logs, current, 'window1', 'renderer.log'))).size }, {
			removed: ['20261104T120000'], bytes: diagnosticLogSessionsMaxBytes + 1, size: diagnosticLogSessionsMaxBytes + 1
		});
	});

	test('keeps files exactly at the byte budget', async () => {
		await session('20261104T120000', diagnosticLogSessionsMaxBytes);
		assert.deepStrictEqual((await clean()).removed, []);
	});

	test('expires sessions at seven days while preserving the newer boundary', async () => {
		await session('20261030T120000', 1, now - 7 * day);
		await session('20261030T120001', 1, now - 7 * day + 1000);
		assert.deepStrictEqual((await clean()).removed, ['20261030T120000']);
	});

	test('retains at most nine inactive sessions, sorted by their names', async () => {
		for (let i = 11; i >= 0; i--) {
			await session(`20261104T1200${String(i).padStart(2, '0')}`);
		}
		assert.deepStrictEqual((await clean()).removed, ['20261104T120000', '20261104T120001', '20261104T120002']);
	});

	test('preserves recent activity inside old sessions and sessions newer than this process', async () => {
		await session('20261001T120000', diagnosticLogSessionsMaxBytes + 1, now - 1000);
		await session('20261107T120000', 1, now - 10 * day);
		const result = await clean();
		assert.deepStrictEqual({ removed: result.removed, preserved: result.preserved }, {
			removed: [], preserved: ['20261001T120000', current, '20261107T120000']
		});
	});

	test('never visits history, Output outside sessions, or unrelated directories', async () => {
		for (const name of ['History', 'workspaceStorage', 'terminal-history', 'output.log', '20261104-not-a-session']) {
			await session(name, diagnosticLogSessionsMaxBytes + 1, now - 30 * day);
		}
		const before = await readdir(logs);
		const result = await clean();
		assert.deepStrictEqual({ files: await readdir(logs), bytes: result.remainingBytes }, { files: before, bytes: 0 });
	});

	test('preserves symlinked sessions and sessions containing symlinks', async () => {
		const outside = join(root, 'outside');
		await mkdir(outside);
		await writeFile(join(outside, 'keep'), 'history');
		await symlink(outside, join(logs, '20261001T120000'), 'junction');
		await session('20261002T120000', 1, now - 30 * day);
		await symlink(outside, join(logs, '20261002T120000', 'external'), 'junction');
		await utimes(join(logs, '20261002T120000'), (now - 30 * day) / 1000, (now - 30 * day) / 1000);
		const result = await clean();
		assert.deepStrictEqual({ removed: result.removed, outside: await readdir(outside), link: (await lstat(join(logs, '20261001T120000'))).isSymbolicLink() }, {
			removed: [], outside: ['keep'], link: true
		});
	});

	test('does not clean through a symlinked root or a custom session name', async () => {
		await session('20261001T120000', 1, now - 30 * day);
		const linked = join(root, 'linked');
		await symlink(logs, linked, 'junction');
		const results = await Promise.all([
			pruneDiagnosticLogSessions(join(linked, current), now),
			pruneDiagnosticLogSessions(join(logs, 'custom'), now)
		]);
		assert.deepStrictEqual({ removed: results.map(result => result.removed), files: await readdir(logs) }, {
			removed: [[], []], files: ['20261001T120000', current]
		});
	});

	test('preserves regular files with session-like names', async () => {
		await writeFile(join(logs, '20261001T120000'), 'keep');
		await utimes(join(logs, '20261001T120000'), (now - 30 * day) / 1000, (now - 30 * day) / 1000);
		assert.deepStrictEqual((await clean()).removed, []);
	});

	test('does not clean siblings when the current session is a symlink', async () => {
		await session('20261001T120000', 1, now - 30 * day);
		await rm(join(logs, current), { recursive: true });
		await symlink(join(logs, '20261001T120000'), join(logs, current), 'junction');
		assert.deepStrictEqual((await clean()).removed, []);
	});

	test('preserves sessions that exceed the bounded directory depth', async () => {
		const name = '20261001T120000';
		let path = join(logs, name);
		const paths = [path];
		for (let i = 0; i < 18; i++) {
			path = join(path, 'nested');
			paths.push(path);
		}
		await mkdir(path, { recursive: true });
		for (const directory of paths.reverse()) {
			await utimes(directory, (now - 30 * day) / 1000, (now - 30 * day) / 1000);
		}
		assert.deepStrictEqual((await clean()).removed, []);
	});

	test('repeated cleanup is safe and keeps the retained diagnostics', async () => {
		await session('20261001T120000', 1, now - 30 * day);
		await session('20261104T120000', 4);
		const first = await clean();
		const second = await clean();
		assert.deepStrictEqual([first.removed, second.removed, second.remainingBytes], [['20261001T120000'], [], 4]);
	});
});
