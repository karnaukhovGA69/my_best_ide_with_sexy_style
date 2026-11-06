/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = async (name: string) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const manifest = await readJSON('package.json');
const theme = await readJSON('themes/nerded-calm.json');
const icons = await readJSON('fileicons/vscode-icons.json');
const provenance = await readJSON('fileicons/provenance.json');
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

test('contributions are local declarative themes with no activation or settings writes', async () => {
	assert.deepEqual(Object.keys(manifest.contributes).sort(), ['iconThemes', 'themes']);
	for (const key of ['main', 'browser', 'activationEvents', 'extensionDependencies', 'extensionPack', 'scripts']) {
		assert.equal(manifest[key], undefined, key);
	}
	assert.equal(manifest.contributes.themes[0].uiTheme, 'vs-dark');
	assert.equal(manifest.contributes.themes[0].id, 'Nerded Calm');
	assert.equal(manifest.contributes.iconThemes[0].id, 'nerded-calm-file-icons');
	for (const contribution of [...manifest.contributes.themes, ...manifest.contributes.iconThemes]) {
		assert.ok(contribution.path.startsWith('./'));
		await readFile(path.join(root, contribution.path));
	}
	for (const name of ['package.nls.json', 'package.nls.ru.json']) {
		const nls = await readJSON(name);
		for (const match of JSON.stringify(manifest).matchAll(/%([^%]+)%/g)) {
			assert.ok(nls[match[1]], `${name}: ${match[1]}`);
		}
	}
});

test('approved palette uses an opaque editor and terminal, without sibling theme includes', () => {
	assert.equal(theme.include, undefined);
	assert.equal(theme.colors['editor.background'], '#101010');
	assert.equal(theme.colors['terminal.background'], '#101010');
	for (const id of ['sideBar.background', 'titleBar.activeBackground', 'statusBar.background']) {
		assert.equal(theme.colors[id], '#151515', id);
	}
	assert.equal(theme.colors['editor.foreground'], '#E6E2DD');
	assert.equal(theme.colors['editorLineNumber.foreground'], '#77717E');
	assert.equal(theme.colors.focusBorder, '#C9B7F3');
	for (const color of Object.values<string>(theme.colors)) {
		assert.match(color, /^#[\da-f]{6}(?:[\da-f]{2})?$/i);
	}
	assert.equal(theme.semanticHighlighting, true);
});

const rgb = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
const luminance = (color: string) => rgb(color).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

test('text, syntax, diagnostics and focus remain readable on their intended surfaces', () => {
	for (const [fg, bg] of [['foreground', 'sideBar.background'], ['descriptionForeground', 'sideBar.background'], ['button.foreground', 'button.background'], ['button.foreground', 'button.hoverBackground'], ['editorError.foreground', 'editor.background'], ['editorWarning.foreground', 'editor.background'], ['editorInfo.foreground', 'editor.background']]) {
		assert.ok(contrast(theme.colors[fg], theme.colors[bg]) >= 4.5, `${fg} on ${bg}`);
	}
	for (const rule of theme.tokenColors) {
		if (rule.settings.foreground) {
			assert.ok(contrast(rule.settings.foreground, theme.colors['editor.background']) >= 4.5, rule.name);
		}
	}
	assert.ok(contrast(theme.colors['editorLineNumber.foreground'], theme.colors['editor.background']) >= 3);
	assert.ok(contrast(theme.colors.focusBorder, theme.colors['sideBar.background']) >= 3);
	assert.equal(new Set(['editorError.foreground', 'editorWarning.foreground', 'editorInfo.foreground'].map(key => theme.colors[key])).size, 3);
	assert.equal(Object.keys(theme.colors).filter(key => key.startsWith('terminal.ansi')).length, 16);
});

test('all release assets are present, unchanged except documented inert markup removal', async () => {
	const files = await readdir(path.join(root, 'fileicons/assets'));
	assert.equal(files.length, 1664);
	assert.equal(new Set(files.map(name => name.toLowerCase())).size, files.length);
	assert.deepEqual(files.sort(), Object.keys(provenance.assets).sort());
	const changed: string[] = [];
	for (const file of files) {
		const data = await readFile(path.join(root, 'fileicons/assets', file));
		const hashes = provenance.assets[file];
		assert.equal(hash(data), hashes.bundled, file);
		if (hashes.upstream !== hashes.bundled) {
			changed.push(file);
		}
	}
	assert.deepEqual(changed.sort(), provenance.sanitizedAssets.sort());
	assert.equal(changed.length, 8);
});

test('SVGs cannot reference external resources or contain executable markup', async () => {
	for (const file of Object.keys(provenance.assets)) {
		const svg = await readFile(path.join(root, 'fileicons/assets', file), 'utf8');
		assert.doesNotMatch(svg, /<(?:script|link|foreignObject|iframe|image|animate\w*|set)\b|\bon\w+\s*=|<!ENTITY|@import/i, file);
		for (const match of svg.matchAll(/(?:href|src)\s*=\s*["']([^"']+)|url\(\s*["']?([^)'"\s]+)/gi)) {
			assert.ok((match[1] ?? match[2]).startsWith('#'), `${file}: ${match[0]}`);
		}
	}
});

test('every referenced path resolves with exact case inside the local icon directory', async () => {
	const files = new Set(await readdir(path.join(root, 'fileicons/assets')));
	assert.equal(Object.keys(icons.iconDefinitions).length, 1508);
	for (const [id, definition] of Object.entries<{ iconPath: string }>(icons.iconDefinitions)) {
		assert.deepEqual(Object.keys(definition), ['iconPath'], id);
		if (!definition.iconPath) {
			continue; // Upstream's unused placeholders for optional light icons.
		}
		assert.match(definition.iconPath, /^\.\/assets\/[a-z\d_+.-]+\.svg$/i, id);
		assert.ok(files.has(definition.iconPath.slice('./assets/'.length)), id);
	}
	assert.equal(icons.fonts, undefined);
	assert.equal(icons.usesCurrentColor, undefined);
	assert.equal(icons.showLanguageModeIcons, false);
	assert.equal(icons.hidesExplorerArrows, false);
});

test('complete associations and light overrides have usable icon definitions', () => {
	for (const [key, count] of Object.entries({ fileExtensions: 599, fileNames: 1922, languageIds: 558, folderNames: 524, folderNamesExpanded: 524 })) {
		assert.equal(Object.keys(icons[key]).length, count, key);
	}
	for (const variant of [icons, icons.light]) {
		const ids = ['file', 'folder', 'folderExpanded', 'rootFolder', 'rootFolderExpanded'].map(key => variant[key]).filter(Boolean);
		for (const key of ['fileExtensions', 'fileNames', 'languageIds', 'folderNames', 'folderNamesExpanded']) {
			ids.push(...Object.values<string>(variant[key] ?? {}));
		}
		for (const id of ids) {
			assert.ok(icons.iconDefinitions[id], id);
			if (!icons.iconDefinitions[id].iconPath) {
				assert.equal(variant, icons.light);
				assert.ok(['_file_light', '_folder_light', '_folder_light_open', '_root_folder_light', '_root_folder_light_open'].includes(id), id);
			}

		}
	}
	assert.notEqual(icons.folder, icons.folderExpanded);
	assert.notEqual(icons.rootFolder, icons.rootFolderExpanded);
	for (const language of ['typescript', 'javascript', 'python', 'json', 'markdown']) {
		assert.ok(icons.languageIds[language], language);
	}
});

test('redistribution includes source provenance and both license texts', async () => {
	assert.equal(provenance.version, '13.0.0');
	assert.match(provenance.archiveSha256, /^[a-f\d]{64}$/);
	assert.match(await readFile(path.join(root, 'licenses/vscode-icons-MIT.txt'), 'utf8'), /Roberto Huertas/);
	assert.match(await readFile(path.join(root, 'licenses/CC-BY-SA-4.0.txt'), 'utf8'), /Attribution-ShareAlike 4.0 International/);
	assert.match(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.txt'), 'utf8'), /Branded icons/);
});
