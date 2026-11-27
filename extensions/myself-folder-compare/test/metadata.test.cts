/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('optional extension has visible Files/results entry points and no runtime deps/proposals', () => {
	assert.deepEqual([manifest.dependencies, manifest.devDependencies, manifest.enabledApiProposals, manifest.extensionKind, manifest.main, manifest.capabilities.untrustedWorkspaces.supported], [undefined, undefined, undefined, ['ui'], './out/extension.js', true]);
	assert.deepEqual(manifest.contributes.menus['view/title'].map(entry => entry.when), ['view == workbench.explorer.fileView', 'view == myself.folderCompare.results']);
	assert.deepEqual(manifest.activationEvents, ['onView:myself.folderCompare.results']);
});

test('manifest localization keys exist in both languages', () => {
	const keys = [...JSON.stringify(manifest).matchAll(/%([^%]+)%/g)].map(match => match[1]);
	for (const bundle of [json('package.nls.json'), json('package.nls.ru.json')]) {
		assert.deepEqual(keys.filter(key => typeof bundle[key] !== 'string'), []);
	}
});

test('runtime localization keys and placeholders match English and Russian', () => {
	const english = json('l10n/bundle.l10n.json');
	const russian = json('l10n/bundle.l10n.ru.json');
	const source = fs.readFileSync(path.join(root, 'src/controller.ts'), 'utf8');
	const literals = [...source.matchAll(/\bt\('((?:\\.|[^'\\])*)'/g)].map(match => match[1].replace(/\\([\\'nrt])/g, (_value, letter) => ({ n: '\n', r: '\r', t: '\t' })[letter] ?? letter));
	assert.deepEqual([...new Set(literals)].sort(), Object.keys(english).sort());
	assert.deepEqual(Object.keys(english).sort(), Object.keys(russian).sort());
	for (const [key, value] of Object.entries(russian)) {
		assert.deepEqual([...key.matchAll(/\{\d+\}/g)].map(match => match[0]).sort(), [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort());
	}
});

test('packaging keeps compiled runtime and excludes sources/tests; no install hooks', () => {
	const ignore = fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8');
	assert.deepEqual([ignore.includes('src/**'), ignore.includes('test/**'), ignore.includes('out/**'), manifest.scripts.install, manifest.scripts.postinstall], [true, true, false, undefined, undefined]);
	assert.ok(fs.existsSync(path.join(root, manifest.main)));
});
