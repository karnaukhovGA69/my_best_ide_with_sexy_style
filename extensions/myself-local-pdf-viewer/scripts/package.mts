/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
interface EngineLock {
	version: string;
	archive: { sha256: string };
	files: Record<string, string>;
	esbuildVersion: string;
	vsceVersion: string;
	workerSha256: string;
}

const lock: EngineLock = JSON.parse(await readFile(path.join(root, 'engine.json'), 'utf8'));
const [archivePath, outputPath] = process.argv.slice(2);
const esbuild = process.env.NERDED_PDF_ESBUILD;
const vsce = process.env.NERDED_PDF_VSCE;
assert.ok(archivePath && outputPath && esbuild && vsce,
	'Usage: NERDED_PDF_ESBUILD=/path/esbuild NERDED_PDF_VSCE=/path/vsce node scripts/package.mts <local-pdfjs.zip> <output.vsix>');
assert.equal(execFileSync(esbuild, ['--version'], { encoding: 'utf8' }).trim(), lock.esbuildVersion);
assert.equal(execFileSync(vsce, ['--version'], { encoding: 'utf8' }).trim(), lock.vsceVersion);

function verify(bytes: Uint8Array, expected: string, name: string) {
	const actual = createHash('sha256').update(bytes).digest('hex');
	assert.equal(actual, expected, `SHA-256 mismatch for ${name}`);
}

const archive = await readFile(archivePath);
verify(archive, lock.archive.sha256, 'Mozilla PDF.js dist ZIP');
const temp = await mkdtemp(path.join(os.tmpdir(), 'nerded-pdf-package-'));
try {
	const stage = path.join(temp, 'stage');
	await mkdir(stage);
	await mkdir(path.join(stage, 'l10n'));
	const verifiedArchive = path.join(temp, 'pdfjs.zip');
	await writeFile(verifiedArchive, archive);
	const notices = new Set<string>();
	for (const [entry, digest] of Object.entries(lock.files)) {
		const bytes = execFileSync('unzip', ['-p', verifiedArchive, entry], { maxBuffer: 8 * 1024 * 1024 });
		verify(bytes, digest, entry);
		if (entry !== 'LICENSE') {
			const notice = bytes.toString('utf8', 0, 4096).match(/^\/\*\*[\s\S]*?@licend[\s\S]*?\*\//)?.[0];
			assert.ok(notice, `Missing Mozilla license header in ${entry}`);
			notices.add(notice);
		}
		const target = entry === 'LICENSE' ? path.join(stage, 'LICENSE.pdfjs.txt') : path.join(temp, path.basename(entry));
		await writeFile(target, bytes);
	}
	for (const filename of ['package.json', 'package.nls.json', 'package.nls.ru.json', 'engine.json', 'LICENSE.txt', 'README.md', 'l10n/bundle.l10n.ru.json']) {
		await copyFile(path.join(root, filename), path.join(stage, filename));
	}
	execFileSync(esbuild, ['src/extension.cts', 'src/local-pdf.cts', 'src/view.cts', '--platform=node', '--format=cjs',
		'--target=node24', '--out-extension:.js=.cjs', `--outdir=${stage}`], { cwd: root, stdio: 'inherit' });
	execFileSync(esbuild, ['src/preview.ts', '--platform=browser', '--format=iife', '--target=es2024',
		`--outfile=${path.join(stage, 'preview.js')}`], { cwd: root, stdio: 'inherit' });
	await copyFile(path.join(root, 'src/worker.mts'), path.join(temp, 'worker-entry.mts'));
	const workerPath = path.join(stage, 'worker.mjs');
	const banner = `/* Combined and minified PDF.js ${lock.version} display and parser modules for Nerded Code. */\n${[...notices].join('\n')}`;
	execFileSync(esbuild, ['worker-entry.mts', '--bundle', '--platform=browser', '--format=esm', '--target=es2024',
		'--minify', '--legal-comments=eof', `--banner:js=${banner}`, '--alias:pdfjs-display=./pdf.mjs', '--alias:pdfjs-parser=./pdf.worker.mjs',
		'--outfile=stage/worker.mjs'], { cwd: temp, stdio: 'inherit' });
	verify(await readFile(workerPath), lock.workerSha256, 'built worker.mjs');

	const packed = path.join(temp, 'preview.vsix');
	execFileSync(vsce, ['package', '--no-dependencies', '--no-rewrite-relative-links', '--allow-missing-repository', '--out', packed],
		{ cwd: stage, stdio: 'inherit' });
	await copyFile(packed, path.resolve(outputPath), constants.COPYFILE_EXCL);
} finally {
	await rm(temp, { recursive: true, force: true });
}
