/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const vsce = require('@vscode/vsce') as typeof import('@vscode/vsce');
const root = path.dirname(import.meta.dirname);
const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
	throw new Error('Usage: node build/package-grammar-extension.ts <extension-folder> [output-directory]');
}

const source = path.join(root, 'extensions', name);
const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
if (manifest.main || manifest.browser || Object.keys(manifest.dependencies ?? {}).length || Object.keys(manifest.optionalDependencies ?? {}).length || manifest.extensionDependencies?.length) {
	throw new Error('This helper only packages standalone declarative extensions. Language servers require a separate build and dependency packaging.');
}

const destination = path.resolve(process.argv[3] ?? path.join(root, '.build/vsix'));
await mkdir(destination, { recursive: true });
const staging = await mkdtemp(path.join(os.tmpdir(), 'myself-ide-grammar-'));
try {
	const files = await vsce.listFiles({ cwd: source, packageManager: vsce.PackageManager.None });
	for (const file of files) {
		const target = path.join(staging, file);
		await mkdir(path.dirname(target), { recursive: true });
		await copyFile(path.join(source, file), target);
	}
	delete manifest.scripts;
	delete manifest.devDependencies;
	await writeFile(path.join(staging, 'package.json'), JSON.stringify(manifest, null, '\t') + '\n');
	await copyFile(path.join(root, 'LICENSE.txt'), path.join(staging, 'LICENSE.txt'));
	const packagePath = path.join(destination, `${manifest.publisher}.${manifest.name}-${manifest.version}.vsix`);
	await vsce.createVSIX({ cwd: staging, packagePath, dependencies: false, allowMissingRepository: true });
	console.log(packagePath);
} finally {
	await rm(staging, { recursive: true, force: true });
}
