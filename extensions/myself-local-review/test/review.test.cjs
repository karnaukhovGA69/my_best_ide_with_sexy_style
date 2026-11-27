/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');

const out = process.env.LOCAL_REVIEW_TEST_OUT ?? path.join(__dirname, '../out');
const { ReviewStore, reviewStorageKey } = require(path.join(out, 'reviewStore.js'));
const entrypoint = require.resolve(path.join(out, 'extension.js'));
const targetModule = require.resolve(path.join(out, 'reviewTargets.js'));

class EventEmitter {
	listeners = new Set();
	event = callback => {
		this.listeners.add(callback);
		return { dispose: () => this.listeners.delete(callback) };
	};
	fire(value) {
		for (const callback of this.listeners) {
			callback(value);
		}
	}
	dispose() { this.listeners.clear(); }
}

class Uri {
	constructor(raw) {
		const url = new URL(raw);
		this.raw = url.href;
		this.scheme = url.protocol.slice(0, -1);
		this.authority = url.host;
		this.query = url.search.slice(1);
		this.fragment = url.hash.slice(1);
		this.path = decodeURIComponent(url.pathname);
		this.fsPath = this.path;
	}
	static parse(value) { return new Uri(value); }
	toString() { return this.raw; }
}

class Range {
	constructor(startLine, startCharacter, endLine, endCharacter) {
		this.start = { line: startLine, character: startCharacter };
		this.end = { line: endLine, character: endCharacter };
		this.active = this.end;
	}
	get isEmpty() { return this.start.line === this.end.line && this.start.character === this.end.character; }
	isEqual(other) {
		return this.start.line === other.start.line && this.start.character === other.start.character
			&& this.end.line === other.end.line && this.end.character === other.end.character;
	}
}

class Document {
	version = 1;
	isClosed = false;
	constructor(uri, text) { this.uri = uri; this.text = text; }
	get lineCount() { return this.text.split('\n').length; }
	lineAt(line) { return { range: new Range(line, 0, line, this.text.split('\n')[line].length) }; }
	offsetAt(position) {
		const lines = this.text.split('\n');
		return lines.slice(0, position.line).reduce((size, line) => size + line.length + 1, 0) + position.character;
	}
	validateRange(range) {
		const clamp = position => {
			const line = Math.min(position.line, this.lineCount - 1);
			return [line, Math.min(position.character, this.lineAt(line).range.end.character)];
		};
		return new Range(...clamp(range.start), ...clamp(range.end));
	}
	getText(range) { return this.text.slice(this.offsetAt(range.start), this.offsetAt(range.end)); }
}

function fixture() {
	const workspaceFolders = ['one', 'two'].map(name => ({ name: 'Same', uri: new Uri(`file:///fixture/${name}`) }));
	const documents = workspaceFolders.map(folder => new Document(new Uri(`${folder.uri}/sample.ts`), 'start\nconst a = 1;\nend'));
	const opened = new EventEmitter();
	const updated = new EventEmitter();
	const closed = new EventEmitter();
	const rootsChanged = new EventEmitter();
	const threads = [];
	const commands = new Map();
	const called = [];
	const shown = [];
	const notices = [];
	const input = [];
	let tree;
	let confirmed = false;
	let stored;
	let writes = 0;
	const storage = {
		get: key => key === reviewStorageKey ? stored : undefined,
		update: async (key, value) => {
			assert.strictEqual(key, reviewStorageKey);
			writes++;
			stored = JSON.parse(JSON.stringify(value));
		},
	};
	const vscode = {
		Uri, Range, EventEmitter,
		l10n: { t: (message, ...args) => message.replace(/\{(\d+)\}/g, (_match, index) => String(args[index])) },
		MarkdownString: class {
			appendCodeblock(value, language) {
				this.text = value;
				this.language = language;
				return this;
			}
		},
		TreeItem: class {
			constructor(label) { this.label = label; }
		},
		TreeItemCollapsibleState: { Expanded: 2 },
		ThemeIcon: class { constructor(id) { this.id = id; } },
		CommentMode: { Preview: 1 },
		CommentThreadState: { Unresolved: 0, Resolved: 1 },
		comments: {
			createCommentController: () => {
				const owned = [];
				return {
					createCommentThread(uri, range, comments) {
						const thread = { uri, range, comments, disposed: false, dispose() { this.disposed = true; } };
						owned.push(thread);
						threads.push(thread);
						return thread;
					},
					dispose() { owned.forEach(thread => thread.dispose()); },
				};
			},
		},
		workspace: {
			workspaceFolders, textDocuments: documents,
			onDidOpenTextDocument: opened.event, onDidChangeTextDocument: updated.event,
			onDidCloseTextDocument: closed.event, onDidChangeWorkspaceFolders: rootsChanged.event,
			getWorkspaceFolder(uri) { return workspaceFolders.find(folder => uri.path === folder.uri.path || uri.path.startsWith(`${folder.uri.path}/`)); },
			asRelativePath: uri => uri.path,
			async openTextDocument(uri) {
				called.push(['open', uri.toString()]);
				const document = documents.find(document => document.uri.toString() === uri.toString());
				if (!document) { throw new Error('Missing document'); }
				document.isClosed = false;
				opened.fire(document);
				return document;
			},
		},
		window: {
			activeTextEditor: { document: documents[0], selection: new Range(1, 0, 1, 5) },
			registerTreeDataProvider(_name, value) { tree = value; return { dispose: () => { tree = undefined; } }; },
			showInputBox: async () => input.shift(),
			showTextDocument: async (document, options) => { shown.push({ document, options }); },
			showInformationMessage: async message => { notices.push(message); },
			showWarningMessage: async (message, _options, label) => { notices.push(message); return confirmed ? label : undefined; },
		},
		commands: {
			registerCommand(name, handler) { commands.set(name, handler); return { dispose: () => commands.delete(name) }; },
			executeCommand: async (...args) => { called.push(args); },
		},
	};
	let subscriptions = [];
	function activate() {
		delete require.cache[entrypoint];
		delete require.cache[targetModule];
		const load = Module._load;
		try {
			Module._load = (name, ...args) => name === 'vscode' ? vscode : load.call(Module, name, ...args);
			require(entrypoint).activate({ workspaceState: storage, subscriptions });
		} finally {
			Module._load = load;
		}
	}
	function dispose() { subscriptions.forEach(item => item.dispose()); subscriptions = []; }
	async function invoke(name, arg) {
		return commands.get(`myself.localReview.${name}`)(arg);
	}
	function children(section) {
		return tree.getChildren(tree.getChildren().find(node => node.section === section));
	}
	activate();
	return { input, threads, notices, called, shown, documents, updated, invoke, children, dispose, activate,
		treeItem: node => tree.getTreeItem(node),
		focus: document => { vscode.window.activeTextEditor.document = document; },
		confirm: () => { confirmed = true; },
		get stored() { return stored; },
		get writes() { return writes; },
	};
}

test('notes in different roots and the checklist survive serialization and reopen', async () => {
	const f = fixture();
	try {
		assert.strictEqual(f.writes, 0);
		assert.deepStrictEqual(f.called, []);
		await f.invoke('open');
		assert.deepStrictEqual(f.called, [['myself.localReview.focus']]);
		f.input.push('Review first file', 'Review second file', 'Run unit tests');
		await f.invoke('addNote');
		f.focus(f.documents[1]);
		await f.invoke('addNote');
		await f.invoke('addCheck');
		const [check] = f.children('checklist');
		await f.invoke('toggleCheck', check);
		assert.strictEqual(new Set(f.stored.notes.map(note => note.root)).size, 2);
		assert.strictEqual(new Set(f.stored.notes.map(note => note.resource)).size, 2);
		f.dispose();
		f.activate();
		assert.strictEqual(f.children('notes').length, 2);
		const [savedCheck] = f.children('checklist');
		assert.strictEqual(f.treeItem(savedCheck).iconPath.id, 'check');
		await f.invoke('openNote', f.children('notes')[1]);
		assert.strictEqual(f.shown.at(-1).document, f.documents[1]);
		assert.ok(f.shown.at(-1).options.selection.isEqual(new Range(1, 0, 1, 5)));
		await f.invoke('deleteCheck', savedCheck);
		assert.strictEqual(f.stored.checks.length, 1);
		f.confirm();
		await f.invoke('deleteCheck', savedCheck);
		assert.strictEqual(f.stored.checks.length, 0);
	} finally {
		f.dispose();
	}
});

test('comment text renders literally and cancellation does not persist or delete records', async () => {
	const f = fixture();
	try {
		await f.invoke('addNote');
		assert.strictEqual(f.writes, 0);
		const text = '[Example](command:sample) ![Image](https://example.invalid/picture) <b>literal</b>';
		f.input.push(text);
		await f.invoke('addNote');
		const [thread] = f.threads;
		const body = thread.comments[0].body;
		assert.deepStrictEqual([body.text, body.language, body.isTrusted, body.supportHtml, body.supportThemeIcons],
			[text, 'plaintext', false, false, false]);
		await f.invoke('resolveNote', thread);
		assert.strictEqual(f.stored.notes[0].resolved, true);
		await f.invoke('reopenNote', thread);
		assert.strictEqual(f.stored.notes[0].resolved, false);
		await f.invoke('deleteNote', thread);
		assert.strictEqual(f.stored.notes.length, 1);
		f.confirm();
		await f.invoke('deleteNote', thread);
		assert.strictEqual(f.stored.notes.length, 0);
		assert.strictEqual(thread.disposed, true);
	} finally {
		f.dispose();
	}
});

test('source changes detach old ranges and stale dialogs cannot write over newer state', async () => {
	const f = fixture();
	try {
		f.input.push('Initial note');
		await f.invoke('addNote');
		const [node] = f.children('notes');
		let finishEdit;
		f.input.push(new Promise(resolve => { finishEdit = resolve; }));
		const editing = f.invoke('editNote', node);
		await f.invoke('resolveNote', node);
		finishEdit('Outdated edit');
		await editing;
		assert.strictEqual(f.stored.notes[0].body, 'Initial note');
		assert.strictEqual(f.stored.notes[0].resolved, true);
		const document = f.documents[0];
		document.text = 'another start\nconst a = 2;\nend';
		document.version++;
		f.updated.fire({ document });
		assert.strictEqual(f.threads.at(-1).disposed, true);
		assert.strictEqual(f.children('notes').length, 1);
		await f.invoke('openNote', node);
		assert.strictEqual(f.shown.at(-1).options.selection, undefined);
		assert.match(f.notices.at(-1), /line context changed/);
		let finishNew;
		f.input.push(new Promise(resolve => { finishNew = resolve; }));
		const writing = f.invoke('addNote');
		document.version++;
		finishNew('New note at old context');
		await writing;
		assert.strictEqual(f.stored.notes.length, 1);
	} finally {
		f.dispose();
	}
});

test('the store rejects malformed data and keeps successful queued updates after an error', async () => {
	const check = { id: randomUUID(), revision: randomUUID(), label: 'Check output', checked: false };
	let stored = { version: 99, notes: [], checks: [] };
	let fail = true;
	const storage = {
		get: () => stored,
		update: async (_key, value) => {
			if (fail) { fail = false; throw new Error('Storage unavailable'); }
			stored = value;
		},
	};
	const unusable = new ReviewStore(storage);
	assert.strictEqual(await unusable.addCheck(check), false);
	assert.strictEqual(stored.version, 99);
	stored = undefined;
	const store = new ReviewStore(storage);
	await assert.rejects(store.addCheck(check), /Storage unavailable/);
	assert.deepStrictEqual(store.state.checks, []);
	assert.strictEqual(await store.addCheck(check), true);
	assert.strictEqual(stored.checks[0].id, check.id);
});

test('notes can only be created on local files in the current workspace', async () => {
	const f = fixture();
	try {
		for (const raw of ['file:///outside/sample.ts', 'vscode-remote://fixture/fixture/one/sample.ts', 'file://server/fixture/one/sample.ts']) {
			f.focus(new Document(new Uri(raw), 'start\nconst a = 1;\nend'));
			f.input.push('Should not be saved');
			await f.invoke('addNote');
		}
		assert.strictEqual(f.writes, 0);
		assert.deepStrictEqual(f.called, []);
	} finally {
		f.dispose();
	}
});
