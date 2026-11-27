/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { resolvePackageDirectory } from '../esbuild-common.mts';
import { assertNoBuildPaths } from '../../build/lib/distributionPrivacy.ts';

const source = import.meta.dirname;
const root = path.resolve(source, '../..');
const require = createRequire(path.join(root, 'build/package.json'));
const vsce = require('@vscode/vsce') as typeof import('@vscode/vsce');
const destination = path.resolve(process.argv[2] ?? path.join(root, '.build/vsix'));
const bundled = [['yauzl', '3.3.1'], ['buffer-crc32', '0.2.13'], ['pend', '1.2.0']] as const;

if (process.argv.length > 3) {
	throw new Error('Usage: node extensions/myself-language-servers/package-vsix.mts [output-directory]');
}
await mkdir(destination, { recursive: true });
const staging = await mkdtemp(path.join(destination, '.language-servers-vsix-'));
try {
	const notices: string[] = [];
	for (const [name, version] of bundled) {
		const directory = resolvePackageDirectory(source, name);
		const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
		if (manifest.version !== version) {
			throw new Error(`Expected the repository-pinned ${name}@${version}.`);
		}
		notices.push(`${name} ${version}\n\n${(await readFile(path.join(directory, 'LICENSE'), 'utf8')).trim()}`);
	}
	await import('./esbuild.mts');
	if (process.exitCode) {
		throw new Error('Extension bundle failed.');
	}
	const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
	manifest.files = ['dist/extension.js', 'LICENSE.txt', 'ThirdPartyNotices.txt'];
	await writeFile(path.join(staging, 'package.json'), JSON.stringify(manifest, null, '\t') + '\n');
	await mkdir(path.join(staging, 'dist'));
	await copyFile(path.join(source, 'dist/extension.js'), path.join(staging, 'dist/extension.js'));
	await copyFile(path.join(root, 'LICENSE.txt'), path.join(staging, 'LICENSE.txt'));
	await writeFile(path.join(staging, 'ThirdPartyNotices.txt'), notices.join('\n\n') + '\n');
	await assertNoBuildPaths(staging, [root, staging]);
	const filename = `${manifest.publisher}.${manifest.name}-${manifest.version}.vsix`;
	const artifact = path.join(staging, filename);
	await vsce.createVSIX({ cwd: staging, packagePath: artifact, dependencies: false, allowMissingRepository: true, target: 'darwin-arm64' });
	await rename(artifact, path.join(destination, filename));
	console.log(path.join(destination, filename));
} finally {
	await rm(staging, { recursive: true, force: true });
}
