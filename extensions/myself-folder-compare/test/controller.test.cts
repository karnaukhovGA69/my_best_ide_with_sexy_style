/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { activateWithApi, plain } = require('../out/controller');
const { compareFolders, defaultLimits } = require('../out/comparison');

class Emitter {
	constructor() { this.listeners = new Set(); this.event = listener => { this.listeners.add(listener); return { dispose: () => this.listeners.delete(listener) }; }; }
	fire(value) { for (const listener of this.listeners) { listener(value); } }
	dispose() { this.listeners.clear(); }
}

function uri(properties) {
	const value = { scheme: 'file', authority: '', path: '/left', fsPath: '/left', query: '', fragment: '', ...properties };
	value.toString = () => `${value.scheme}://${value.authority}${value.path}${value.query ? `?${value.query}` : ''}${value.fragment ? `#${value.fragment}` : ''}`;
	return value;
}

const changed = () => ({ entries: [{ path: 'nested/a.txt', status: 'changed', original: Buffer.from('old'), modified: Buffer.from('new') }], bytesRead: 6, examined: 4, incomplete: false, cancelled: false });

function host(t, scan = async () => changed()) {
	const handlers = new Map();
	const closed = new Emitter();
	const calls = { picker: 0, scan: [], dispatch: [], information: [] };
	const state = { picks: [[uri({ fsPath: '/left' })], [uri({ path: '/right', fsPath: '/right' })]], confirmation: true, view: {}, documents: [], failDiff: false };
	const subscriptions = [];
	const api = {
		EventEmitter: Emitter,
		CancellationTokenSource: class {
			constructor() { this.token = { isCancellationRequested: false }; }
			cancel() { this.token.isCancellationRequested = true; }
			dispose() { }
		},
		TreeItem: class { constructor(label) { this.label = label; } },
		TreeItemCollapsibleState: { None: 0 }, ThemeIcon: class { constructor(id) { this.id = id; } },
		Uri: { from: properties => uri(properties) },
		ProgressLocation: { Notification: 1 },
		FileSystemError: { FileNotFound: message => new Error(message) },
		l10n: { t: (value, ...args) => value.replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)])) },
		env: {},
		workspace: {
			get textDocuments() { return state.documents; },
			onDidCloseTextDocument: closed.event,
			registerTextDocumentContentProvider: (_scheme, provider) => { state.contentProvider = provider; return { dispose() { state.contentProvider = undefined; } }; }
		},
		window: {
			createTreeView: (_id, options) => { state.treeProvider = options.treeDataProvider; return Object.assign(state.view, { dispose() { } }); },
			showOpenDialog: async () => { calls.picker++; return state.picks.shift(); },
			showInformationMessage: async (message, options, button) => { calls.information.push(message); return options?.modal && state.confirmation ? button : undefined; },
			showErrorMessage: async message => { state.error = message; },
			withProgress: async (_options, callback) => callback({}, { onCancellationRequested: listener => { state.cancelProgress = listener; return { dispose() { state.cancelProgress = undefined; } }; } })
		},
		commands: {
			registerCommand: (id, handler) => { handlers.set(id, handler); return { dispose: () => handlers.delete(id) }; },
			executeCommand: async (id, ...args) => {
				calls.dispatch.push([id, ...args]);
				if (id === 'vscode.diff') {
					if (state.failDiff) {
						throw new Error('fixture error');
					}
					state.lastContents = args.slice(0, 2).map(value => state.contentProvider.provideTextDocumentContent(value));
					for (const value of args.slice(0, 2)) {
						if (!state.documents.some(document => document.uri.toString() === value.toString())) {
						state.documents.push({ uri: value });
						}
					}
				}
			}
		}
	};
	const controller = activateWithApi({ subscriptions }, api, async (...args) => { calls.scan.push(args); return scan(...args); });
	const dispose = () => { for (const item of subscriptions.splice(0)) { item.dispose(); } };
	t.after(dispose);
	const resetPicks = () => { state.picks = [[uri({ fsPath: '/next-left', path: '/next-left' })], [uri({ fsPath: '/next-right', path: '/next-right' })]]; };
	const closeDocuments = () => { const old = state.documents; state.documents = []; for (const document of old) { closed.fire(document); } };
	return { api, state, calls, handlers, controller, dispose, resetPicks, closeDocuments };
}

test('activation, view opening, getChildren and menu commands cause zero scanning', t => {
	const h = host(t);
	assert.deepEqual([h.controller.provider.getChildren(), h.calls.scan, h.calls.dispatch, h.calls.picker], [[], [], [], 0]);
});

test('both folder pickers and explicit confirmation precede the only scan; args ignored', async t => {
	const h = host(t);
	await h.handlers.get('myself.folderCompare.compare')(uri({ fsPath: '/external' }));
	assert.deepEqual([h.calls.picker, h.calls.scan.map(args => args.slice(0, 2)), h.calls.dispatch.map(args => args[0])], [2, [['/left', '/right']], ['myself.folderCompare.results.focus']]);
});

test('cancelling either picker or final confirmation performs no scan or diff', async t => {
	for (const stage of [0, 1, 2]) {
		const h = host(t);
		if (stage < 2) {
			h.state.picks[stage] = undefined;
		} else {
			h.state.confirmation = false;
		}
		await h.controller.compare();
		assert.deepEqual([h.calls.scan, h.calls.dispatch], [[], []]);
	}
});

test('remote window rejects action before any picker or scan', async t => {
	const h = host(t);
	h.api.env.remoteName = 'ssh-remote';
	await h.controller.compare();
	assert.deepEqual([h.calls.picker, h.calls.scan], [0, []]);
});

test('authority, custom scheme, query, fragment and UNC picker results are rejected', async t => {
	for (const properties of [{ authority: 'server' }, { scheme: 'custom' }, { query: 'path=other' }, { fragment: 'other' }, { fsPath: '//server/share' }, { fsPath: 'relative' }]) {
		const h = host(t);
		h.state.picks[0] = [uri(properties)];
		await h.controller.compare();
		assert.deepEqual([h.calls.picker, h.calls.scan], [1, []]);
	}
});

test('diff uses two immutable generated provider URIs and no file URI or source args', async t => {
	const h = host(t);
	await h.controller.compare();
	await h.controller.open(h.controller.provider.getChildren()[0]);
	const diff = h.calls.dispatch.find(args => args[0] === 'vscode.diff');
	assert.deepEqual([diff.slice(1, 3).map(value => value.scheme), h.state.lastContents], [['myself-folder-compare-snapshot', 'myself-folder-compare-snapshot'], ['old', 'new']]);
	assert.ok(diff.slice(1, 3).every(value => !value.path.includes('nested') && !value.query && !value.authority));
});

test('forged command objects, URI args and skipped rows never dispatch a diff', async t => {
	const h = host(t, async () => ({ ...changed(), incomplete: true, entries: [{ path: 'blocked', status: 'skipped', reason: 'link' }] }));
	await h.controller.compare();
	for (const value of [uri({}), { generation: 'fake', preview: true, original: 'external' }, h.controller.provider.getChildren()[0]]) {
		await h.handlers.get('myself.folderCompare.openDiff')(value);
	}
	assert.equal(h.calls.dispatch.filter(args => args[0] === 'vscode.diff').length, 0);
});

test('empty added/removed files have valid empty sides, unlike unknown snapshots', async t => {
	const h = host(t, async () => ({ ...changed(), entries: [{ path: 'added', status: 'added', modified: Buffer.alloc(0) }, { path: 'removed', status: 'removed', original: Buffer.alloc(0) }] }));
	await h.controller.compare();
	for (const row of h.controller.provider.getChildren()) {
		await h.controller.open(row);
		assert.deepEqual(h.state.lastContents, ['', '']);
	}
	assert.throws(() => h.state.contentProvider.provideTextDocumentContent(uri({ scheme: 'myself-folder-compare-snapshot', path: '/unknown' })), /unavailable/);
});

test('binary, invalid UTF-8, directory and type-conflict rows have no preview', async t => {
	const h = host(t, async () => ({ ...changed(), entries: [
		{ path: 'binary', status: 'changed', original: Buffer.from([0, 1]), modified: Buffer.from([0, 2]) },
		{ path: 'encoding', status: 'added', modified: Buffer.from([0xff]) },
		{ path: 'directory', status: 'added', reason: 'directory' }, { path: 'type', status: 'changed', reason: 'type' }
	] }));
	await h.controller.compare();
	assert.deepEqual(h.controller.provider.getChildren().map(row => Boolean(h.controller.provider.getTreeItem(row).command)), [false, false, false, false]);
});

test('control, bidi and icon syntax in names are plain escaped text', async t => {
	const name = '$(warning)\n\u202e.txt';
	const h = host(t, async () => ({ ...changed(), entries: [{ ...changed().entries[0], path: name }] }));
	await h.controller.compare();
	const item = h.controller.provider.getTreeItem(h.controller.provider.getChildren()[0]);
	assert.deepEqual([item.label, typeof item.tooltip], [plain(name), 'string']);
	assert.equal(item.label, '\\$(warning)\\u000a\\u202e.txt');
});

test('new comparison invalidates old items but preserves already-open snapshot contents', async t => {
	let content = 'old';
	const h = host(t, async () => ({ ...changed(), entries: [{ ...changed().entries[0], original: Buffer.from(content) }] }));
	await h.controller.compare();
	const oldItem = h.controller.provider.getChildren()[0];
	await h.controller.open(oldItem);
	const oldUri = h.calls.dispatch.find(args => args[0] === 'vscode.diff')[1];
	content = 'different';
	h.resetPicks();
	await h.controller.compare();
	await h.controller.open(oldItem);
	assert.deepEqual([h.state.contentProvider.provideTextDocumentContent(oldUri), h.calls.dispatch.filter(args => args[0] === 'vscode.diff').length], ['old', 1]);
	h.closeDocuments();
	assert.throws(() => h.state.contentProvider.provideTextDocumentContent(oldUri), /unavailable/);
});

test('provider rejects known snapshot IDs with authority/query/fragment or other scheme', async t => {
	const h = host(t);
	await h.controller.compare();
	await h.controller.open(h.controller.provider.getChildren()[0]);
	const original = h.calls.dispatch.find(args => args[0] === 'vscode.diff')[1];
	for (const properties of [{ query: 'x' }, { fragment: 'x' }, { authority: 'server' }, { scheme: 'file' }]) {
		assert.throws(() => h.state.contentProvider.provideTextDocumentContent(uri({ ...original, ...properties })), /unavailable/);
	}
});

test('reopening a current row reuses its immutable pair instead of consuming budget', async t => {
	const h = host(t);
	await h.controller.compare();
	const row = h.controller.provider.getChildren()[0];
	for (let i = 0; i < 18; i++) {
		await h.controller.open(row);
	}
	assert.equal(new Set(h.calls.dispatch.filter(args => args[0] === 'vscode.diff').map(args => args[1].toString())).size, 1);
});

test('retained snapshot bytes reduce the next scan budget and close releases them', async t => {
	const h = host(t);
	await h.controller.compare();
	await h.controller.open(h.controller.provider.getChildren()[0]);
	h.resetPicks();
	await h.controller.compare();
	assert.equal(h.calls.scan[1][2].limits.totalBytes, defaultLimits.totalBytes - 6);
	h.closeDocuments();
	h.resetPicks();
	await h.controller.compare();
	assert.equal(h.calls.scan[2][2].limits.totalBytes, defaultLimits.totalBytes);
});

test('sixteen open pairs refuse extra snapshots without evicting existing ones', async t => {
	const h = host(t, async () => ({ ...changed(), entries: Array.from({ length: 17 }, (_value, index) => ({ ...changed().entries[0], path: String(index) })) }));
	await h.controller.compare();
	for (const row of h.controller.provider.getChildren()) {
		await h.controller.open(row);
	}
	assert.equal(h.calls.dispatch.filter(args => args[0] === 'vscode.diff').length, 16);
	assert.match(h.calls.information.at(-1), /Close previous/);
});

test('cancel during scan or disposed controller publishes no results or diff', async t => {
	const h = host(t, async (_left, _right, options) => { h.state.cancelProgress(); assert.equal(options.cancelled(), true); return changed(); });
	await h.controller.compare();
	assert.deepEqual([h.controller.provider.getChildren(), h.calls.dispatch], [[], []]);
	const disposed = host(t, async () => { disposed.dispose(); return changed(); });
	await disposed.controller.compare();
	assert.deepEqual([disposed.controller.provider.getChildren(), disposed.calls.dispatch], [[], []]);
});

test('overlapping actions cannot start another scan while first is pending', async t => {
	let release;
	const pending = new Promise(resolve => { release = resolve; });
	const h = host(t, async () => pending);
	const first = h.controller.compare();
	await new Promise(resolve => setImmediate(resolve));
	await h.controller.compare();
	release(changed());
	await first;
	assert.equal(h.calls.scan.length, 1);
});

test('failed diff releases its pair and retry remains possible', async t => {
	const h = host(t);
	await h.controller.compare();
	const row = h.controller.provider.getChildren()[0];
	h.state.failDiff = true;
	await h.controller.open(row);
	h.state.failDiff = false;
	await h.controller.open(row);
	assert.deepEqual(h.state.lastContents, ['old', 'new']);
});

test('snapshot diff remains valid after actual source deletion, without new disk reads', async t => {
	const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'folder-diff-host-')));
	t.after(() => fs.rm(base, { recursive: true, force: true }));
	const left = path.join(base, 'left');
	const right = path.join(base, 'right');
	await fs.mkdir(left);
	await fs.mkdir(right);
	await fs.writeFile(path.join(left, 'a.txt'), 'original');
	await fs.writeFile(path.join(right, 'a.txt'), 'modified');
	const h = host(t, compareFolders);
	h.state.picks = [[uri({ path: left, fsPath: left })], [uri({ path: right, fsPath: right })]];
	await h.controller.compare();
	await fs.rm(left, { recursive: true });
	await fs.rm(right, { recursive: true });
	await h.controller.open(h.controller.provider.getChildren()[0]);
	assert.deepEqual(h.state.lastContents, ['original', 'modified']);
});

test('disposal unregisters commands, removes provider and rejects old items', async t => {
	const h = host(t);
	await h.controller.compare();
	const item = h.controller.provider.getChildren()[0];
	const provider = h.state.contentProvider;
	h.dispose();
	await h.controller.open(item);
	assert.deepEqual([h.handlers.size, h.state.contentProvider, h.calls.dispatch.filter(args => args[0] === 'vscode.diff').length], [0, undefined, 0]);
	assert.throws(() => provider.provideTextDocumentContent(uri({ scheme: 'myself-folder-compare-snapshot' })), /unavailable/);
});

test('incomplete empty results are never described as identical', async t => {
	const h = host(t, async () => ({ ...changed(), incomplete: true, entries: [] }));
	await h.controller.compare();
	assert.doesNotMatch(h.state.view.message, /identical/);
	assert.match(h.state.view.message, /Incomplete/);
});
