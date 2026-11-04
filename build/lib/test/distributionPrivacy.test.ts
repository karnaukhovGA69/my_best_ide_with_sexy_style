/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import * as asar from 'asar';
import pickle from 'chromium-pickle-js';
import { assertNoBuildPaths, refreshDarwinAsarMetadata, sanitizeDarwinDistribution } from '../distributionPrivacy.ts';

const execFileAsync = promisify(execFile);

test('detects private build paths across stream boundaries and in UTF-16', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'distribution-privacy-'));
	const privatePath = '/private-builder/workspace';
	try {
		const file = path.join(directory, 'artifact.bin');
		for (const value of [Buffer.from(privatePath), Buffer.from(privatePath, 'utf16le'), Buffer.from(privatePath, 'utf16le').swap16()]) {
			await writeFile(file, Buffer.concat([Buffer.alloc(65530), value]));
			await assert.rejects(assertNoBuildPaths(directory, [privatePath]), /artifact\.bin/);
		}
		await writeFile(file, 'No build paths.');
		await assertNoBuildPaths(directory, [privatePath]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('rejects symlinks that expose build paths without scanning their destinations', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'distribution-privacy-'));
	try {
		await symlink('/private-builder/not-present', path.join(directory, 'external-link'));
		await assert.rejects(assertNoBuildPaths(directory, ['/private-builder']), /external-link/);
		if (process.platform === 'darwin') {
			await assert.rejects(sanitizeDarwinDistribution(directory, ['/private-builder']), /Distribution contains private build paths in: external-link/);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('refuses native runtime path literals instead of rewriting executable bytes', { skip: process.platform !== 'darwin' }, async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'distribution-privacy-'));
	try {
		const outputDirectory = path.join(directory, 'output');
		await mkdir(outputDirectory);
		const source = path.join(directory, 'fixture.c');
		const output = path.join(outputDirectory, 'fixture');
		await writeFile(source, '#include <stdio.h>\nint main(void) { puts(__FILE__); return 0; }\n');
		await execFileAsync('xcrun', ['clang', source, '-o', output]);
		await assert.rejects(sanitizeDarwinDistribution(outputDirectory, [directory]), /Distribution contains private build paths in: fixture/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('strips real Mach-O debug paths while preserving exports, execution and ASAR metadata', { skip: process.platform !== 'darwin' }, async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'distribution-privacy-'));
	try {
		const sourceDirectory = path.join(directory, 'private-builder');
		const outputDirectory = path.join(directory, 'output');
		await mkdir(sourceDirectory);
		await mkdir(outputDirectory);
		const source = path.join(sourceDirectory, 'fixture.c');
		const object = path.join(sourceDirectory, 'fixture.o');
		const archive = path.join(outputDirectory, 'deps.asar');
		await mkdir(`${archive}.unpacked`);
		const output = path.join(`${archive}.unpacked`, 'fixture');
		await writeFile(source, '#include <stdio.h>\nint main(void) { puts("native-ok"); return 0; }\n');
		await execFileAsync('xcrun', ['clang', '-g', '-c', source, '-o', object]);
		await execFileAsync('xcrun', ['clang', object, '-o', output]);
		const initialBytes = await readFile(output);
		const packedBytes = Buffer.from('Packed payload stays unchanged.');
		const blockSize = 4096;
		const headerPickle = pickle.createEmpty();
		headerPickle.writeString(JSON.stringify({ files: {
			fixture: { size: initialBytes.length, unpacked: true, integrity: { algorithm: 'SHA256', hash: 'stale', blockSize, blocks: [] } },
			'packed.txt': { size: packedBytes.length, offset: '0' }
		} }));
		const headerBuffer = headerPickle.toBuffer();
		const sizePickle = pickle.createEmpty();
		sizePickle.writeUInt32(headerBuffer.length);
		await writeFile(archive, Buffer.concat([sizePickle.toBuffer(), headerBuffer, packedBytes]));
		const before = await execFileAsync('nm', ['-gU', output]);
		await assert.rejects(assertNoBuildPaths(outputDirectory, [sourceDirectory]), /fixture/);
		const stripped = await sanitizeDarwinDistribution(outputDirectory, [sourceDirectory]);
		// Code signing is deliberately after strip, as it is for the application bundle.
		await execFileAsync('codesign', ['--force', '--sign', '-', output]);
		await refreshDarwinAsarMetadata(outputDirectory);
		const after = await execFileAsync('nm', ['-gU', output]);
		const executed = await execFileAsync(output);
		const finalBytes = await readFile(output);
		const metadata = asar.statFile(archive, 'fixture') as asar.FileMetadata & { integrity: { hash: string; blocks: string[] } };
		const blocks: string[] = [];
		for (let index = 0; index < finalBytes.length; index += blockSize) {
			blocks.push(createHash('sha256').update(finalBytes.subarray(index, index + blockSize)).digest('hex'));
		}
		assert.deepStrictEqual({ size: metadata.size, hash: metadata.integrity.hash, blocks: metadata.integrity.blocks, payload: asar.extractFile(archive, 'packed.txt') }, {
			size: finalBytes.length, hash: createHash('sha256').update(finalBytes).digest('hex'), blocks, payload: packedBytes,
		});
		assert.strictEqual(await refreshDarwinAsarMetadata(outputDirectory), 0);
		assert.deepStrictEqual({ stripped, exportsUnchanged: before.stdout === after.stdout, output: executed.stdout }, {
			stripped: 1, exportsUnchanged: true, output: 'native-ok\n',
		});
		await assertNoBuildPaths(outputDirectory, [sourceDirectory]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
