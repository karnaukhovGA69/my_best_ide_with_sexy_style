/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Disposable, WebviewOptions, WebviewPanelOptions } from 'vscode';
import type { PreviewHost } from '../src/extension.cjs';
import type { LocalPdfUri, PdfInputFailure } from '../src/local-pdf.cjs';
import type { DocumentMessage } from '../src/protocol.js';
import { vectorDocument } from './pdf-fixture.mts';

interface PackageManifest {
	extensionDependencies?: string[];
	dependencies?: Record<string, string>;
	activationEvents?: string[];
	contributes: {
		customEditors?: unknown[];
		commands: Array<{ command: string }>;
		menus: { 'view/title': Array<{ command: string }> };
	};
}

const archive = process.env.NERDED_PDF_TEST_VSIX ?? '';
assert.ok(archive, 'Pass the built VSIX in NERDED_PDF_TEST_VSIX');
const require = createRequire(import.meta.url);
const catalog: { workerSha256: string; files: { LICENSE: string } } = require('../engine.json');
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
let temporary: string;
let root: string;

function extract(entry: string) {
	return execFileSync('unzip', ['-p', archive, entry], { maxBuffer: 4 * 1024 * 1024 });
}

before(async () => {
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
	const pkg: PackageManifest = require(path.join(root, 'package.json'));
	assert.deepEqual([pkg.extensionDependencies, pkg.dependencies, pkg.contributes.customEditors, pkg.activationEvents], [undefined, undefined, undefined, undefined]);
	assert.equal(pkg.contributes.menus['view/title'][0].command, pkg.contributes.commands[0].command);
	const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
	const worker = extract('extension/worker.mjs');
	assert.equal(sha256(worker), catalog.workerSha256);
	assert.match(worker.subarray(0, 2048).toString(), /Copyright 2024 Mozilla Foundation/);
	assert.equal(sha256(extract('extension/LICENSE.pdfjs.txt')), catalog.files.LICENSE);
});

function asFile(file: string): LocalPdfUri {
	return { scheme: 'file', fsPath: file, path: pathToFileURL(file).pathname, authority: '', query: '', fragment: '' };
}

test('the host accepts bounded regular PDF bytes and rejects remote, symlink, directory and oversized inputs', async () => {
	const { readLocalPdf, maxPdfBytes }: typeof import('../src/local-pdf.cjs') = require(path.join(root, 'local-pdf.cjs'));
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
	const rejected: Array<[LocalPdfUri, PdfInputFailure]> = [
		[{ ...asFile(actual), scheme: 'vscode-remote' }, 'local'],
		[{ ...asFile(actual), authority: 'host' }, 'local'],
		[asFile(link), 'local'], [asFile(folder), 'local'], [asFile(large), 'size'], [asFile(fake), 'format'],
	];
	for (const [uri, reason] of rejected) {
		await assert.rejects(() => readLocalPdf(uri), { reason });
	}
});

test('the packaged command ignores arguments, waits for the picker, and sends bytes only for the active panel token', async () => {
	const { registerPreview }: typeof import('../src/extension.cjs') = require(path.join(root, 'extension.cjs'));
	const fixture = vectorDocument();
	const file = path.join(temporary, 'picked-only.pdf');
	await fs.writeFile(file, fixture);
	const subscriptions: Disposable[] = [];
	const sent: DocumentMessage[] = [];
	const panels: Array<{
		options: WebviewPanelOptions & WebviewOptions;
		webview: { html: string };
		dispose(): void;
		receive(message: unknown): void;
	}> = [];
	const warnings: string[] = [];
	let command: ((...args: unknown[]) => Promise<void>) | undefined;
	const picker: { selected?: LocalPdfUri[] } = {};
	let dialogs = 0;
	const vscode: PreviewHost = {
		l10n: { t: (key, ...args) => key.replace(/\{(\d+)\}/g, (_, index: string) => args[Number(index)]) },
		env: { language: 'en' },
		ViewColumn: { Beside: -2 },
		commands: { registerCommand: (id, handler) => { command = handler; return { dispose() {} }; } },
		window: {
			async showOpenDialog() { dialogs++; return picker.selected; },
			async showWarningMessage(message) { warnings.push(message); },
			async showErrorMessage(message) { warnings.push(message); },
			createWebviewPanel(_type, _title, _column, options) {
				let close: (() => void) | undefined;
				let receive: ((message: unknown) => void) | undefined;
				const panel = {
					options,
					onDidDispose(listener: () => void) { close = listener; return { dispose() {} }; },
					dispose() { close?.(); },
					receive(message: unknown) { receive?.(message); },
					webview: {
						html: '',
						async postMessage(message: DocumentMessage) { sent.push(message); return true; },
						onDidReceiveMessage(listener: (message: unknown) => void) {
							receive = listener;
							return { dispose() { receive = undefined; } };
						},
					},
				};
				panels.push(panel);
				return panel;
			},
		},
	};
	registerPreview(vscode, { subscriptions });
	assert.ok(command);
	await command(asFile(file));
	assert.deepEqual([dialogs, panels.length, warnings], [1, 0, []]);
	picker.selected = [asFile(file)];
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
	assert.equal(sent.length, 0);
	panel.receive({ kind: 'ready', token: match[1] });
	assert.deepEqual(Object.keys(sent[0]).sort(), ['bytes', 'engine', 'kind', 'token']);
	assert.deepEqual(Buffer.from(sent[0].bytes), fixture);
	panel.dispose();
	panel.receive({ kind: 'ready', token: match[1] });
	assert.equal(sent.length, 1);
});
