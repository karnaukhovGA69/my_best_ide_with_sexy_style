/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { pathToFileURL } = require('node:url');
const { vectorDocument } = require('./pdf-fixture.cjs');

const archive = process.env.NERDED_PDF_TEST_VSIX;
const catalog = require('../engine.json');
const entryNames = [
	'[Content_Types].xml',
	'extension.vsixmanifest',
	'extension/LICENSE.pdfjs.txt',
	'extension/LICENSE.txt',
	'extension/readme.md',
	'extension/engine.json',
	'extension/extension.cjs',
	'extension/l10n/bundle.l10n.ru.json',
	'extension/local-pdf.cjs',
	'extension/package.json',
	'extension/package.nls.json',
	'extension/package.nls.ru.json',
	'extension/preview.js',
	'extension/view.cjs',
	'extension/worker.mjs',
].sort();
let temporary;
let root;

function extract(entry) {
	return execFileSync('unzip', ['-p', archive, entry], { maxBuffer: 4 * 1024 * 1024 });
}

before(async () => {
	assert.ok(archive, 'Pass the built VSIX in NERDED_PDF_TEST_VSIX');
	temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'nerded-pdf-package-test-'));
	root = path.join(temporary, 'extension');
	execFileSync('unzip', ['-q', archive, '-d', temporary]);
});

after(async () => {
	if (temporary) {
		await fs.rm(temporary, { recursive: true, force: true });
	}
});

test('the VSIX contains the exact extension payload, notices and verified worker', () => {
	const actual = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort();
	assert.deepEqual(actual, entryNames);
	const manifest = extract('extension.vsixmanifest').toString();
	assert.match(manifest, /Id="myself-local-pdf-viewer" Version="0\.1\.0".*Publisher="myself"/);
	assert.match(manifest, /Id="Microsoft\.VisualStudio\.Code\.Engine" Value="\^1\.146\.0"/);
	const pkg = require(path.join(root, 'package.json'));
	assert.deepEqual([pkg.extensionDependencies, pkg.dependencies, pkg.contributes.customEditors, pkg.activationEvents], [undefined, undefined, undefined, undefined]);
	assert.equal(pkg.contributes.menus['view/title'][0].command, pkg.contributes.commands[0].command);
	const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
	const worker = extract('extension/worker.mjs');
	assert.equal(sha256(worker), catalog.workerSha256);
	assert.match(worker.subarray(0, 2048).toString(), /Copyright 2024 Mozilla Foundation/);
	assert.equal(sha256(extract('extension/LICENSE.pdfjs.txt')), catalog.files.LICENSE);
});

function asFile(file) {
	return { scheme: 'file', fsPath: file, path: new URL(pathToFileURL(file)).pathname, authority: '', query: '', fragment: '' };
}

test('the host accepts bounded regular PDF bytes and rejects remote, symlink, directory and oversized inputs', async () => {
	const { readLocalPdf, maxPdfBytes } = require(path.join(root, 'local-pdf.cjs'));
	const actual = path.join(temporary, 'local.pdf');
	const fake = path.join(temporary, 'impostor.pdf');
	const link = path.join(temporary, 'linked.pdf');
	const large = path.join(temporary, 'large.pdf');
	const folder = path.join(temporary, 'folder.pdf');
	const fixture = vectorDocument();
	await fs.writeFile(actual, fixture);
	await fs.writeFile(fake, Buffer.from([0xa5, 0xd0, 0xc4, 0xc6, 0xad]));
	await fs.symlink(actual, link);
	await (await fs.open(large, 'w')).close();
	await fs.truncate(large, maxPdfBytes + 1);
	await fs.mkdir(folder);
	assert.deepEqual(Buffer.from(await readLocalPdf(asFile(actual))), fixture);
	for (const [uri, reason] of [
		[{ ...asFile(actual), scheme: 'vscode-remote' }, 'local'],
		[{ ...asFile(actual), authority: 'host' }, 'local'],
		[asFile(link), 'local'], [asFile(folder), 'local'], [asFile(large), 'size'], [asFile(fake), 'format'],
	]) {
		await assert.rejects(() => readLocalPdf(uri), { reason });
	}
});

test('the packaged command ignores arguments, waits for the picker, and sends bytes only for the active panel token', async () => {
	const { registerPreview } = require(path.join(root, 'extension.cjs'));
	const fixture = vectorDocument();
	const file = path.join(temporary, 'picked-only.pdf');
	await fs.writeFile(file, fixture);
	const subscriptions = [];
	const sent = [];
	const panels = [];
	const warnings = [];
	let command;
	let selected;
	let dialogs = 0;
	const vscode = {
		l10n: { t: (key, ...args) => key.replace(/\{(\d+)\}/g, (_, index) => args[Number(index)]) },
		env: { language: 'en' },
		ViewColumn: { Beside: -2 },
		commands: { registerCommand: (id, handler) => { command = handler; return { dispose() {} }; } },
		window: {
			async showOpenDialog() { dialogs++; return selected; },
			async showWarningMessage(message) { warnings.push(message); },
			async showErrorMessage(message) { warnings.push(message); },
			createWebviewPanel(type, title, column, options) {
				const panel = {
					type, title, column, options,
					onDidDispose(listener) { panel.close = listener; },
					dispose() { panel.close(); },
					webview: {
						async postMessage(message) { sent.push(message); return true; },
						onDidReceiveMessage(listener) { panel.receive = listener; return { dispose() {} }; },
					},
				};
				panels.push(panel);
				return panel;
			},
		},
	};
	registerPreview(vscode, { subscriptions });
	await command(asFile(file));
	assert.deepEqual([dialogs, panels.length, warnings], [1, 0, []]);
	selected = [asFile(file)];
	await command('/unselected.pdf', 'https://invalid.example/');
	assert.deepEqual([panels.length, warnings], [1, []]);
	const panel = panels[0];
	assert.deepEqual(panel.options, {
		enableScripts: true, enableCommandUris: false, enableFindWidget: false, localResourceRoots: [], retainContextWhenHidden: false,
	});
	const match = panel.webview.html.match(/<script nonce="([^"]+)">/);
	assert.ok(match);
	assert.ok(!panel.webview.html.includes('picked-only.pdf'));
	panel.receive({ kind: 'ready', token: 'wrong' });
	panel.receive({ kind: 'open', token: match[1], path: '/unselected.pdf' });
	assert.deepEqual(sent, []);
	panel.receive({ kind: 'ready', token: match[1] });
	assert.deepEqual(Object.keys(sent[0]).sort(), ['bytes', 'engine', 'kind', 'token']);
	assert.deepEqual(Buffer.from(sent[0].bytes), fixture);
	panel.dispose();
	panel.receive({ kind: 'ready', token: match[1] });
	assert.equal(sent.length, 1);
});
