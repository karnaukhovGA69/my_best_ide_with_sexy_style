/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const Module = require('node:module');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pipeline } = require('node:stream/promises');
const { test } = require('node:test');
const { ZipFile } = require('yazl');
const { createRequire } = require('node:module');

const darwinArm64 = process.platform === 'darwin' && process.arch === 'arm64';
const vsix = process.env.LANGUAGE_SERVERS_TEST_VSIX;
const requireBuild = createRequire(resolve(__dirname, '../../../build/package.json'));

test('bundled VSIX registers a working import, refresh and removal flow', { skip: !darwinArm64 || !vsix }, async t => {
	const root = await fs.mkdtemp(join(tmpdir(), 'lsp-vsix-test-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const unpacked = join(root, 'vsix');
	const files = [];
	await requireBuild('extract-zip')(resolve(vsix), { dir: unpacked, onEntry: entry => files.push(entry.fileName) });
	assert.deepEqual(files.sort(), [
		'[Content_Types].xml', 'extension.vsixmanifest', 'extension/LICENSE.txt', 'extension/ThirdPartyNotices.txt',
		'extension/dist/extension.js', 'extension/package.json',
	]);
	const manifest = JSON.parse(await fs.readFile(join(unpacked, 'extension/package.json'), 'utf8'));
	assert.deepEqual(manifest.extensionKind, ['ui']);
	assert.equal(manifest.capabilities.untrustedWorkspaces.supported, true);
	assert.match(await fs.readFile(join(unpacked, 'extension.vsixmanifest'), 'utf8'), /TargetPlatform="darwin-arm64"/);
	assert.match(await fs.readFile(join(unpacked, 'extension/ThirdPartyNotices.txt'), 'utf8'), /yauzl 3\.3\.1/);

	const source = join(root, 'server.zip');
	const zip = new ZipFile();
	// macOS provides a compatible universal executable for format inspection.
	zip.addFile('/usr/bin/true', 'bin/fixture');
	zip.addBuffer(Buffer.from('test resource'), 'resource.txt');
	zip.end();
	await pipeline(zip.outputStream, createWriteStream(source));

	const storage = join(root, 'user-storage');
	const uri = (scheme, fsPath) => ({ scheme, fsPath, authority: '' });
	let selection = uri('file', source);
	let provider;
	let choose;
	const commands = new Map();
	const errors = [];
	const changes = [];
	const noOp = () => ({ dispose() {} });
	const mock = {
		TreeItem: class TreeItem { constructor(label) { this.label = label; } },
		ThemeIcon: class ThemeIcon {},
		EventEmitter: class EventEmitter {
			event = noOp;
			fire() { changes.push('refresh'); }
			dispose() {}
		},
		ProgressLocation: { Notification: 15 },
		l10n: { t: (message, ...args) => message.replace(/\{(\d+)\}/g, (_match, index) => args[index]) },
		commands: { registerCommand: (id, handler) => { commands.set(id, handler); return noOp(); } },
		window: {
			createTreeView(_id, options) { provider = options.treeDataProvider; return noOp(); },
			createOutputChannel: () => ({ ...noOp(), error: error => errors.push(error) }),
			showOpenDialog: async () => [selection],
			showQuickPick: async entries => { choose = entries; return entries[0]; },
			withProgress: async (_options, run) => run(undefined, { isCancellationRequested: false, onCancellationRequested: noOp }),
			showInformationMessage: async () => undefined,
			showWarningMessage: async (_message, options, button) => {
				assert.match(options.detail, /all IDE profiles/);
				return button;
			},
			showErrorMessage: async error => { errors.push(error); },
		},
	};
	const original = Module._load;
	Module._load = function (specifier, ...rest) {
		return specifier === 'vscode' ? mock : original.call(this, specifier, ...rest);
	};
	try {
		require(join(unpacked, 'extension', manifest.main)).activate({ globalStorageUri: uri('file', storage), subscriptions: [] });
	} finally {
		Module._load = original;
	}
	for (const command of manifest.contributes.commands) {
		assert.ok(commands.has(command.command));
	}
	await commands.get('myself.languageServers.importZip')();
	assert.deepEqual(choose, ['bin/fixture']);
	const items = await provider.getChildren();
	assert.equal(items.length, 1);
	assert.equal(items[0].label, 'fixture');
	await commands.get('myself.languageServers.remove')(items[0]);
	await commands.get('myself.languageServers.refresh')();
	assert.deepEqual(await provider.getChildren(), []);
	assert.deepEqual(await fs.readdir(join(storage, 'managed')), []);
	assert.deepEqual(errors, []);
	assert.equal(changes.length, 3);

	selection = uri('https', source);
	await commands.get('myself.languageServers.importZip')();
	assert.match(errors[0], /ZIP on this computer/);
	assert.deepEqual(await provider.getChildren(), []);
});
