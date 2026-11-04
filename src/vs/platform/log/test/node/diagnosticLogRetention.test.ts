/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { diagnosticLogMaxFileSize, isCoreDiagnosticLogger, prepareDiagnosticLog } from '../../node/diagnosticLogRetention.js';

suite('Diagnostic log retention', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const now = Date.UTC(2026, 10, 4, 12);
	let folder: string;

	setup(async () => { folder = await mkdtemp(join(tmpdir(), 'myself-log-test-')); });
	teardown(async () => { await rm(folder, { recursive: true, force: true }); });

	async function put(name: string, contents: string, modified = now): Promise<void> {
		const file = join(folder, name);
		await writeFile(file, contents);
		await utimes(file, new Date(modified), new Date(modified));
	}

	test('restricts retention to core diagnostics without changing Output channels', () => {
		assert.deepStrictEqual([
			isCoreDiagnosticLogger(),
			isCoreDiagnosticLogger({ name: 'Extension Host' }),
			isCoreDiagnosticLogger({ extensionId: 'example.extension' }),
			isCoreDiagnosticLogger({ logLevel: 'always' }),
			isCoreDiagnosticLogger({ donotRotate: true }),
			isCoreDiagnosticLogger({ donotUseFormatters: true }),
		], [true, true, false, false, false, false]);
	});

	test('keeps same-day log, rotates on next UTC day and preserves unrelated output', async () => {
		await put('main.log', 'current');
		await put('extension-output.log', 'user output');
		await prepareDiagnosticLog(join(folder, 'main.log'), now);
		assert.strictEqual(await readFile(join(folder, 'main.log'), 'utf8'), 'current');
		await prepareDiagnosticLog(join(folder, 'main.log'), now + 86400000);
		assert.deepStrictEqual(await readdir(folder), ['extension-output.log', 'main.1.log']);
	});

	test('expiry boundary deletes only owned channel files', async () => {
		await put('main.log', 'expired', now - 7 * 86400000);
		await put('main.1.log', 'recent', now - 7 * 86400000 + 1);
		await put('other.log', 'must remain', now - 8 * 86400000);
		await prepareDiagnosticLog(join(folder, 'main.log'), now);
		assert.deepStrictEqual(await readdir(folder), ['main.1.log', 'other.log']);
	});

	test('bounds legacy oversized files and backup count to 10 MiB', async () => {
		for (let i = 0; i <= 6; i++) {
			await put(i ? `main.${i}.log` : 'main.log', 'x'.repeat(diagnosticLogMaxFileSize + 100));
		}
		await prepareDiagnosticLog(join(folder, 'main.log'), now);
		const files = await readdir(folder);
		const sizes = await Promise.all(files.map(async file => (await stat(join(folder, file))).size));
		assert.deepStrictEqual({ files, sizes }, {
			files: ['main.1.log', 'main.2.log', 'main.3.log', 'main.4.log', 'main.log'],
			sizes: Array(5).fill(diagnosticLogMaxFileSize)
		});
	});

	test('rollover drops oldest backup and shifts the remaining files', async () => {
		for (let i = 0; i <= 4; i++) {
			await put(i ? `main.${i}.log` : 'main.log', String(i));
		}
		await prepareDiagnosticLog(join(folder, 'main.log'), now, true);
		assert.deepStrictEqual(await Promise.all((await readdir(folder)).map(file => readFile(join(folder, file), 'utf8'))), ['0', '1', '2', '3']);
	});

	test('does not follow or delete a symlink supplied as a log file', async () => {
		await put('user-file', 'keep');
		await symlink(join(folder, 'user-file'), join(folder, 'main.log'));
		await assert.rejects(prepareDiagnosticLog(join(folder, 'main.log'), now), /regular files/);
		assert.strictEqual(await readFile(join(folder, 'user-file'), 'utf8'), 'keep');
	});
});
