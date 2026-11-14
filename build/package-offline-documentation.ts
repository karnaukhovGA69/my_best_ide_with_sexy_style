/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import extractZip from 'extract-zip';
import { extract } from 'tar';
import { assertNoBuildPaths } from './lib/distributionPrivacy.ts';

const require = createRequire(import.meta.url);
const vsce = require('@vscode/vsce') as typeof import('@vscode/vsce');
const execFileAsync = promisify(execFile);
const sourceDirectory = 'extensions/myself-documents/documentation';
const groups = new Set(['go', 'rust', 'postgresql', 'bash', 'linux']);
const metadataFiles = new Set([
	'catalog.json',
	'NOTICE.txt',
	'sources.json',
	'licenses/go-content-license.txt',
	'licenses/go-license.txt',
	'licenses/linux-man-pages-6.20.tar.gz',
	'licenses/rust-license-apache.txt',
	'licenses/rust-license-mit.txt',
]);
const manifest = {
	publisher: 'myself',
	name: 'offline-documentation',
	displayName: 'Nerded Code Offline Documentation',
	description: 'Local documentation for Go, Rust, PostgreSQL, Bash and Linux man-pages.',
	version: '0.1.0',
	engines: { vscode: '^1.95.0' },
	extensionKind: ['ui'],
	categories: ['Other'],
	license: 'SEE LICENSE IN documentation/NOTICE.txt',
	files: ['documentation/**'],
};

interface Catalog {
	groups?: { id: string }[];
	entries?: { id: string; file: string; group: string; sha256: string }[];
}

function isArticleFile(file: string): boolean {
	const [group, article, extra] = file.split('/');
	return groups.has(group) && /^[a-z\d_][a-z\d_.-]*\.html$/i.test(article) && extra === undefined;
}

async function stageDocumentation(root: string, staging: string, temporaryDirectory: string): Promise<string[]> {
	const { stdout: revision } = await execFileAsync('git', ['rev-parse', '--verify', `HEAD:${sourceDirectory}`], { cwd: root });
	const tree = revision.trim();
	const { stdout: inventory } = await execFileAsync('git', ['ls-tree', '-r', '-z', tree], { cwd: root });
	const blobs = new Map<string, string>();
	const caseFoldedPaths = new Set<string>();
	for (const record of inventory.slice(0, -1).split('\0')) {
		const match = /^100644 blob ([a-f\d]+)\t(.+)$/.exec(record);
		if (!match) {
			throw new Error('The documentation tree must contain only regular, non-executable files.');
		}
		const [, oid, file] = match;
		if (file === '.gitignore') {
			continue;
		}
		if (!metadataFiles.has(file) && !isArticleFile(file)) {
			throw new Error(`Unexpected tracked documentation file: ${file}`);
		}
		const caseFoldedPath = file.toLowerCase();
		if (caseFoldedPaths.has(caseFoldedPath)) {
			throw new Error(`Case-insensitive documentation path collision: ${file}`);
		}
		caseFoldedPaths.add(caseFoldedPath);
		blobs.set(file, oid);
	}
	for (const file of metadataFiles) {
		if (!blobs.has(file)) {
			throw new Error(`Missing documentation metadata: ${file}`);
		}
	}

	// Archiving the committed tree bypasses checkout line-ending conversions and symlinks.
	const archive = path.join(temporaryDirectory, 'documentation.tar');
	await execFileAsync('git', ['archive', '--format=tar', `--output=${archive}`, tree], { cwd: root });
	const documentation = path.join(staging, 'documentation');
	await mkdir(documentation);
	await extract({ cwd: documentation, file: archive, strict: true, filter: file => file !== '.gitignore' });

	const catalog: Catalog = JSON.parse(await readFile(path.join(documentation, 'catalog.json'), 'utf8'));
	if (!Array.isArray(catalog?.groups) || !Array.isArray(catalog.entries)) {
		throw new Error('Invalid documentation catalog.');
	}
	const catalogGroups = new Set(catalog.groups.map(group => group?.id));
	if (catalogGroups.size !== groups.size || catalog.groups.length !== groups.size || [...catalogGroups].some(group => !groups.has(group))) {
		throw new Error('The documentation catalog must contain the five official groups.');
	}
	const articleHashes = new Map<string, string>();
	const articleGroups = new Set<string>();
	const articleIds = new Set<string>();
	for (const entry of catalog.entries) {
		if (!entry || typeof entry.id !== 'string' || !entry.id || articleIds.has(entry.id) || typeof entry.file !== 'string') {
			throw new Error('Invalid documentation catalog entry.');
		}
		const { id, file, group, sha256 } = entry;
		if (!isArticleFile(file) || !groups.has(group) || !file.startsWith(`${group}/`) || !blobs.has(file)
			|| articleHashes.has(file) || typeof sha256 !== 'string' || !/^[a-f\d]{64}$/.test(sha256)) {
			throw new Error(`Invalid catalog article path or hash: ${file}`);
		}
		articleHashes.set(file, sha256);
		articleGroups.add(group);
		articleIds.add(id);
	}
	if (articleGroups.size !== groups.size) {
		throw new Error('Each official group must contain at least one article.');
	}
	for (const [file, oid] of blobs) {
		const articleHash = articleHashes.get(file);
		if (!articleHash && !metadataFiles.has(file)) {
			throw new Error(`Tracked article is missing from the catalog: ${file}`);
		}
		const data = await readFile(path.join(documentation, file));
		const blobHash = createHash(oid.length === 64 ? 'sha256' : 'sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
		if (blobHash !== oid || (articleHash && createHash('sha256').update(data).digest('hex') !== articleHash)) {
			throw new Error(`Documentation content does not match its hash: ${file}`);
		}
	}
	return [...blobs.keys()].map(file => `documentation/${file}`);
}

async function verifyPackage(packagePath: string, staging: string, directory: string, files: readonly string[]): Promise<void> {
	const entries = new Set(['[Content_Types].xml', 'extension.vsixmanifest', ...files.map(file => `extension/${file}`)]);
	await mkdir(directory);
	await extractZip(packagePath, {
		dir: directory,
		onEntry(entry) {
			const mode = entry.externalFileAttributes >>> 16;
			if (!entries.delete(entry.fileName) || (mode & 0o170111) !== 0o100000) {
				throw new Error(`Unexpected VSIX entry: ${entry.fileName}`);
			}
		},
	});
	if (entries.size > 0) {
		throw new Error(`Missing VSIX entries: ${[...entries].join(', ')}`);
	}
	for (const file of files) {
		const packaged = await readFile(path.join(directory, 'extension', file));
		if (!packaged.equals(await readFile(path.join(staging, file)))) {
			throw new Error(`VSIX changed the contents of ${file}`);
		}
	}
}

export async function packageOfflineDocumentation(root: string, destination: string): Promise<string> {
	await mkdir(destination, { recursive: true });
	const temporaryDirectory = await mkdtemp(path.join(destination, '.offline-documentation-'));
	try {
		const staging = path.join(temporaryDirectory, 'staging');
		await mkdir(staging);
		const files = await stageDocumentation(root, staging, temporaryDirectory);
		files.push('package.json');
		await writeFile(path.join(staging, 'package.json'), JSON.stringify(manifest, null, '\t') + '\n');

		const filename = `${manifest.publisher}.${manifest.name}-${manifest.version}.vsix`;
		const packagePath = path.join(temporaryDirectory, filename);
		await vsce.createVSIX({ cwd: staging, packagePath, dependencies: false, allowMissingRepository: true });
		const verification = path.join(temporaryDirectory, 'verification');
		await verifyPackage(packagePath, staging, verification, files);
		await assertNoBuildPaths(verification, [root, await realpath(root), await realpath(temporaryDirectory), os.homedir()]);
		const checksum = createHash('sha256').update(await readFile(packagePath)).digest('hex');
		const checksumFile = `${filename}.sha256`;
		await writeFile(path.join(temporaryDirectory, checksumFile), `${checksum}  ${filename}\n`);
		await rename(packagePath, path.join(destination, filename));
		await rename(path.join(temporaryDirectory, checksumFile), path.join(destination, checksumFile));
		return path.join(destination, filename);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	if (process.argv.length > 3) {
		throw new Error('Usage: node build/package-offline-documentation.ts [output-directory]');
	}
	const root = path.dirname(import.meta.dirname);
	const destination = path.resolve(process.argv[2] ?? path.join(root, '.build/vsix'));
	console.log(await packageOfflineDocumentation(root, destination));
}
