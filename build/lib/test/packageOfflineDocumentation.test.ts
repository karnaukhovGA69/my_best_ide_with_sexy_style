/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import extractZip from 'extract-zip';
import { packageOfflineDocumentation } from '../../package-offline-documentation.ts';

test('packages only committed documentation and rejects invalid snapshots', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'offline-documentation-test-'));
	const source = path.join(root, 'extensions/myself-documents/documentation');
	const output = path.join(root, 'output');
	const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
	const commit = () => {
		git('add', '--all', 'extensions');
		const tree = git('write-tree').toString().trim();
		const revision = git('-c', 'user.name=Documentation Test', '-c', 'user.email=test@example.invalid',
			'commit-tree', tree, '-m', 'Documentation fixture').toString().trim();
		git('update-ref', 'HEAD', revision);
	};
	try {
		git('init', '--template=');
		const ids = ['go', 'rust', 'postgresql', 'bash', 'linux'];
		const groups = ids.map(id => ({ id, title: id, version: '1', license: 'Test' }));
		const entries = await Promise.all(ids.map(async group => {
			const text = `<h1>${group}</h1>\n`;
			const file = `${group}/Article.html`;
			await mkdir(path.join(source, group), { recursive: true });
			await writeFile(path.join(source, file), text);
			return {
				id: file, group, file, title: group, source: `https://example.invalid/${group}`, format: 'html',
				sha256: createHash('sha256').update(text).digest('hex'),
			};
		}));
		const catalog = path.join(source, 'catalog.json');
		const writeCatalog = () => writeFile(catalog, JSON.stringify({ groups, entries }));
		await writeCatalog();
		const metadata = [
			'NOTICE.txt', 'sources.json', 'licenses/go-content-license.txt', 'licenses/go-license.txt',
			'licenses/linux-man-pages-6.20.tar.gz', 'licenses/rust-license-apache.txt', 'licenses/rust-license-mit.txt',
		];
		await mkdir(path.join(source, 'licenses'));
		for (const file of metadata) {
			await writeFile(path.join(source, file), file === 'sources.json' ? '{}' : 'fixture');
		}
		await writeFile(path.join(source, '.gitignore'), '.downloads/\n');
		commit();

		await writeFile(path.join(source, 'untracked.js'), 'throw new Error();');
		await writeFile(path.join(source, 'go/Article.html'), 'uncommitted edit');
		const archive = await packageOfflineDocumentation(root, output);
		const checksum = createHash('sha256').update(await readFile(archive)).digest('hex');
		assert.equal(await readFile(`${archive}.sha256`, 'utf8'), `${checksum}  ${path.basename(archive)}\n`);
		const archiveEntries: string[] = [];
		const unpacked = path.join(root, 'unpacked');
		await extractZip(archive, { dir: unpacked, onEntry: entry => archiveEntries.push(entry.fileName) });
		assert.deepEqual(archiveEntries.sort(), [
			'[Content_Types].xml', 'extension.vsixmanifest', 'extension/package.json',
			...['catalog.json', ...metadata, ...entries.map(entry => entry.file)].map(file => `extension/documentation/${file}`),
		].sort());
		assert.equal(await readFile(path.join(unpacked, 'extension/documentation/go/Article.html'), 'utf8'), '<h1>go</h1>\n');
		const manifest = JSON.parse(await readFile(path.join(unpacked, 'extension/package.json'), 'utf8'));
		assert.equal(`${manifest.publisher}.${manifest.name}`, 'myself.offline-documentation');
		assert.deepEqual(manifest.extensionKind, ['ui']);
		for (const key of ['main', 'browser', 'activationEvents', 'dependencies', 'extensionDependencies', 'extensionPack']) {
			assert.equal(Object.hasOwn(manifest, key), false, key);
		}

		await rm(path.join(source, 'untracked.js'));
		entries[0].file = 'go/article.html';
		await writeCatalog();
		commit();
		await assert.rejects(packageOfflineDocumentation(root, output), /Invalid catalog article path or hash: go\/article\.html/);

		entries[0].file = 'go/Article.html';
		await writeCatalog();
		commit();
		await assert.rejects(packageOfflineDocumentation(root, output), /Documentation content does not match its hash: go\/Article\.html/);

		await writeFile(path.join(source, 'go/Article.html'), '<h1>go</h1>\n');
		await writeFile(path.join(source, 'go/Extra.html'), 'unlisted article');
		commit();
		await assert.rejects(packageOfflineDocumentation(root, output), /Tracked article is missing from the catalog: go\/Extra\.html/);
		await rm(path.join(source, 'go/Extra.html'));

		if (process.platform !== 'win32') {
			await rm(path.join(source, 'go/Article.html'));
			await symlink('../../../outside.html', path.join(source, 'go/Article.html'), 'file');
			commit();
			await assert.rejects(packageOfflineDocumentation(root, output), /only regular, non-executable files/);
		}
		assert.deepEqual((await readdir(output)).sort(), [path.basename(archive), `${path.basename(archive)}.sha256`]);
		assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), checksum);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
