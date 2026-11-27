/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const localFs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { maxCatalogBytes, maxDocumentBytes } = require('../out/libraryModel.js');
const { loadWithVscode, emitter, viewApi } = require('./helpers.cts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
	let resolve;
	const promise = new Promise(done => { resolve = done; });
	return { promise, resolve };
}
const uri = value => ({ path: value, fsPath: value, scheme: 'file', authority: '', toString: () => value });
async function fixture(options = {}) {
	const actions = new Map(), reads = [], writes = [], notices = [], information = [], warnings = [], dialogOptions = [], external = [], sent = [], dialogs = [], opened = [];
	const state = { imports: options.imports ?? [] };
	let provider, readerProvider, readerOptions, reader, selection, activeEditor, reveal; let beforeRead = options.beforeRead, beforeOfficialRead = options.beforeRead;
	const extensionsChange = emitter();
	let installed;
	let nextPost;
	const post = async message => {
		sent.push(message);
		nextPost?.resolve(message);
		nextPost = undefined;
		return true;
	};
	const waitForTreeChange = () => new Promise(resolve => {
		const sub = provider.onDidChangeTreeData(() => { sub.dispose(); resolve(); });
	});
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'myself-reader-')));
	const bundled = path.join(root, 'extension');
	const profileRoot = path.join(root, 'profile');
	fs.mkdirSync(profileRoot);
	const files = new class extends Map {
		set(key, value) {
			if (key.startsWith('/profile/')) {
				const target = path.join(root, key);
				fs.mkdirSync(path.dirname(target), { recursive: true });
				fs.writeFileSync(target, value);
			}
			return super.set(key, value);
		}
		delete(key) {
			if (key.startsWith('/profile/')) { fs.rmSync(path.join(root, key), { force: true }); }
			return super.delete(key);
		}
	}();
	const installedRoot = path.join(root, 'offline-vsix');
	function openReader() {
		if (reader?.visible) { return; }
		if (reader && !reader.disposed) { reader.setVisible(true); return; }
		const messages = emitter(), disposed = emitter(), visibility = emitter();
		reader = {
			visible: true, disposed: false, messages,
			dispose() { this.disposed = true; this.visible = false; disposed.fire(); },
			setVisible(value) { this.visible = value; visibility.fire(); },
			onDidDispose: disposed.event, onDidChangeVisibility: visibility.event,
			webview: { cspSource: 'https://local.invalid', asWebviewUri: resource => resource.toString(), onDidReceiveMessage: messages.event, postMessage: post }
		};
		readerProvider.resolveWebviewView(reader);
	}
	const catalog = { groups: [{ id: 'test', title: 'Test', version: '1', license: 'MIT' }], entries: [
		{ id: 'one', group: 'test', title: 'One', file: 'test/one.html', source: 'https://example.invalid/one.html', format: 'html' },
		{ id: 'two', group: 'test', title: 'Two', file: 'test/two.html', source: 'https://example.invalid/two.html', format: 'html' },
	] };
	function writeCatalog(extensionPath, label = '') {
		const docs = path.join(extensionPath, 'documentation');
		fs.mkdirSync(path.join(docs, 'test'), { recursive: true });
		const groups = catalog.groups.map(group => ({ ...group, title: label + group.title }));
		fs.writeFileSync(path.join(docs, 'catalog.json'), JSON.stringify({ ...catalog, groups }));
		fs.writeFileSync(path.join(docs, 'test/one.html'), '<h1>' + label + 'One</h1>');
		fs.writeFileSync(path.join(docs, 'test/two.html'), '<h1>' + label + 'Two</h1>');
	}

	function setInstalled(location, version = '1') {
		installed = location ? { extensionUri: location, packageJSON: { version }, isActive: false, activate: () => assert.fail('resource package must stay inactive') } : undefined;
		extensionsChange.fire();
	}
	fs.mkdirSync(bundled);
	if (options.bundled !== false) { writeCatalog(bundled); }
	if (options.installed) {
		writeCatalog(installedRoot, 'VSIX ');
		setInstalled(uri(installedRoot));
	}
	if (options.prepare) { options.prepare({ bundled, installedRoot, root, catalog }); }
	const vscode = {
		...viewApi, extensions: {
			getExtension: id => { assert.equal(id, 'myself.offline-documentation'); return installed; },
			onDidChange: extensionsChange.event,
		}, Uri: { joinPath: (base, ...parts) => uri(base.path + '/' + parts.join('/')), parse: value => ({ toString: () => value }) },
		EventEmitter: class { constructor() { const e = emitter(); this.event = e.event; this.fire = e.fire; } dispose() {} },
		TreeItem: class { constructor(label) { this.label = label; } }, TreeItemCollapsibleState: { None: 0, Collapsed: 1 }, ThemeIcon: class { constructor(id) { this.id = id; } },
		Disposable: { from: (...disposables) => ({ dispose: () => disposables.forEach(d => d.dispose()) }) },
		env: { language: 'en', openExternal: async value => { external.push(value.toString()); return true; } },
		window: {
			get activeTextEditor() { return activeEditor; },
			createTreeView: (_id, options) => { provider = options.treeDataProvider; return { dispose() {} }; },
			registerWebviewViewProvider: (id, provider, options) => {
				assert.equal(id, 'myself.documentation.reader');
				readerProvider = provider;
				readerOptions = options;
				return { dispose() {} };
			},
			showQuickPick: async items => options.quickPick?.(items),
			showOpenDialog: async settings => {
				dialogs.push('open');
				dialogOptions.push(settings);
				return options.dialog ? options.dialog(selection) : selection;
			},
			showErrorMessage: async text => { notices.push(text); },
			showWarningMessage: async (message, settings, button) => {
				warnings.push({ message, settings, button });
				return options.confirmPdfRemoval?.(button);
			},
			showInformationMessage: async (message, action) => {
				information.push(message);
				return options.confirm ? options.confirm(action) : action;
			},
		},
		commands: {
			registerCommand: (id, action) => { actions.set(id, action); return { dispose() {} }; },
			executeCommand: async (id, options) => {
				opened.push([id, options]);
				if (reveal) { await reveal(openReader); } else { openReader(); }
			}
		},
		workspace: { fs: {
			readFile: async resource => { reads.push(resource.path); if (beforeRead) { await beforeRead(resource.path); } if (!files.has(resource.path)) { throw new Error('missing'); } return files.get(resource.path); },
			stat: async resource => ({ size: files.get(resource.path)?.length ?? 0 }),
			createDirectory: async () => {}, writeFile: async (resource, bytes) => { writes.push(resource.path); if (options.beforeWrite) { await options.beforeWrite(); } files.set(resource.path, bytes); },
			delete: async resource => { files.delete(resource.path); },
		} },
	};
	const context = { subscriptions: [], extensionUri: uri(bundled), globalStorageUri: { ...uri('/profile'), fsPath: profileRoot }, globalState: { get: () => state.imports, update: async (_key, value) => { if (options.beforeUpdate) { await options.beforeUpdate(); } state.imports = value; } } };
	const openFile = localFs.open;
	localFs.open = async (file, flags) => {
		if (file.startsWith(root + path.sep) && file.includes(path.sep + 'documentation' + path.sep)) {
			reads.push(file);
			if (beforeOfficialRead) { await beforeOfficialRead(file); }
		} else if (file.startsWith(profileRoot + path.sep)) {
			const resource = '/' + path.relative(root, file);
			reads.push(resource);
			if (beforeRead) { await beforeRead(resource); }
		}
		return openFile(file, flags);
	};
	const dispose = () => {
		context.subscriptions.forEach(d => d.dispose());
		localFs.open = openFile;
		fs.rmSync(root, { recursive: true, force: true });
	};
	try {
		loadWithVscode('library.js', vscode).registerLibrary(context);
		if (!options.deferCatalog) { await waitForTreeChange(); }
		return { actions, provider, files, reads, writes, notices, information, warnings, external, sent, state, dialogs, dialogOptions, opened, readerOptions, bundled, installedRoot, root, writeCatalog, setInstalled, waitForTreeChange,
			reader: () => reader, select: value => { selection = value; }, setEditor: value => { activeEditor = value; },
			delay: handler => { beforeRead = handler; beforeOfficialRead = handler; },
			delayReveal: handler => { reveal = handler; },
			change: () => extensionsChange.fire(),
			message: async (value, response = false) => {
				if (response) { nextPost = deferred(); }
				const posted = nextPost?.promise;
				reader.messages.fire(value);
				await (response ? posted : tick());
			}, dispose };
	} catch (error) {
		dispose();
		throw error;
	}
}

test('reader opens in the library view without taking editor focus and sends content only after ready', async () => {
	const f = await fixture();
	try {
		await f.actions.get('myself.documentation.open')('one');
		assert.deepEqual(f.opened, [['myself.documentation.reader.open', { preserveFocus: true }]]);
		assert.equal(f.readerOptions.webviewOptions.retainContextWhenHidden, true);
		assert.equal(f.sent.length, 0);
		await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).text, '<h1>One</h1>');
		assert.ok(!f.reader().webview.html.includes('<h1>One</h1>'));
		assert.deepEqual(f.reader().webview.options.localResourceRoots.map(r => r.path), [path.join(f.bundled, 'media'), path.join(f.bundled, 'out/webview')]);
		await f.message({ type: 'link', href: 'two.html#section' }, true);
		assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).fragment, f.external.length], ['Two', 'section', 0]);
		await f.message({ type: 'back' }, true); assert.equal(f.sent.at(-1).title, 'One');
	} finally { f.dispose(); }
});

test('collapsing and expanding the reader does not rerender the current article', async () => {
	const f = await fixture();
	try {
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' });
		f.reader().setVisible(false);
		f.reader().setVisible(true);
		await tick();
		assert.equal(f.sent.length, 1);
		await f.actions.get('myself.documentation.open')('two');
		assert.equal(f.opened.length, 1);
		assert.equal(f.sent.at(-1).title, 'Two');
	} finally { f.dispose(); }
});

test('local imports are copied into the profile, are recorded persistently and remove only that copy', async () => {
	const f = await fixture();
	try {
		f.files.set('/chosen/manual.html', Buffer.from('<h1>Local manual</h1>')); f.select([uri('/chosen/manual.html')]);
		await f.actions.get('myself.documentation.import')();
		const imported = f.state.imports[0]; assert.ok(imported); assert.equal(imported.source, '');
		await f.actions.get('myself.documentation.open')(imported.id); await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).text, '<h1>Local manual</h1>');
		await f.actions.get('myself.documentation.remove')(imported);
		assert.equal(f.state.imports.length, 0); assert.ok(f.files.has('/chosen/manual.html')); assert.equal(f.files.has('/profile/' + imported.file), false);
	} finally { f.dispose(); }
});

test('cancel, non-local input, invalid UTF-8 and oversized imports never create a library entry', async () => {
	const f = await fixture();
	try {
		await f.actions.get('myself.documentation.import')();
		f.select([{ ...uri('/remote.html'), scheme: 'https' }]); await f.actions.get('myself.documentation.import')();
		f.files.set('/bad.txt', Buffer.from([0xff, 0xfe])); f.select([uri('/bad.txt')]); await f.actions.get('myself.documentation.import')();
		f.files.set('/large.txt', Buffer.alloc(16 * 1024 * 1024 + 1)); f.select([uri('/large.txt')]); await f.actions.get('myself.documentation.import')();
		assert.deepEqual({ writes: f.writes, imports: f.state.imports, external: f.external }, { writes: [], imports: [], external: [] });
	} finally { f.dispose(); }
});

test('unknown identities and command links cannot read files or execute commands; source is explicit', async () => {
	const f = await fixture();
	try {
		const before = f.reads.length; await f.actions.get('myself.documentation.open')('../secret'); assert.equal(f.reads.length, before);
		await f.actions.get('myself.documentation.open')('one'); await f.message({ type: 'ready' });
		await f.message({ type: 'link', href: 'command:workbench.action.terminal.new' }); assert.deepEqual(f.external, []);
		await f.message({ type: 'source' }); assert.deepEqual(f.external, ['https://example.invalid/one.html']);
	} finally { f.dispose(); }
});

test('a slower earlier read never replaces the newly selected document', async () => {
	const f = await fixture(); let release;
	try {
		const gate = new Promise(resolve => { release = resolve; });
		const entered = deferred();
		f.delay(file => file.endsWith('one.html') ? (entered.resolve(), gate) : undefined);
		const first = f.actions.get('myself.documentation.open')('one'); await entered.promise;
		await f.actions.get('myself.documentation.open')('two'); await f.message({ type: 'ready' });
		release(); await first;
		assert.equal(f.sent.at(-1).title, 'Two');
	} finally { release?.(); f.dispose(); }
});


test('closing the reader cancels a pending navigation without reopening it', async () => {
	const f = await fixture(); let release;
	try {
		await f.actions.get('myself.documentation.open')('one');
		const originalReader = f.reader();
		const gate = new Promise(resolve => { release = resolve; });
		const entered = deferred();
		f.delay(file => file.endsWith('two.html') ? (entered.resolve(), gate) : undefined);
		const pending = f.actions.get('myself.documentation.open')('two'); await entered.promise;
		originalReader.dispose(); release(); await pending;
		assert.equal(f.reader(), originalReader, 'completed navigation must not reopen the reader');
		assert.deepEqual(f.notices, []);
		await f.actions.get('myself.documentation.open')('two');
		assert.notEqual(f.reader(), originalReader, 'a later explicit open still works');
	} finally { release?.(); f.dispose(); }
});

test('disposal while the catalog loads prevents pending commands from opening a reader', async () => {
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	const entered = deferred();
	const f = await fixture({ deferCatalog: true, beforeRead: file => file.endsWith('catalog.json') ? (entered.resolve(), gate) : undefined });
	try {
		const pending = f.actions.get('myself.documentation.open')('one');
		await entered.promise;
		f.dispose(); release(); await pending;
		assert.equal(f.reader(), undefined);
		assert.deepEqual(f.reads, [path.join(f.bundled, 'documentation/catalog.json')]);
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('a failed read completed after closing the reader does not show a stale error', async () => {
	const f = await fixture(); let release;
	try {
		await f.actions.get('myself.documentation.open')('one');
		const gate = new Promise(resolve => { release = resolve; });
		const entered = deferred();
		f.delay(file => file.endsWith('two.html') ? (entered.resolve(), gate) : undefined);
		const pending = f.actions.get('myself.documentation.open')('two'); await entered.promise;
		f.reader().dispose(); fs.unlinkSync(path.join(f.bundled, 'documentation/test/two.html')); release(); await pending;
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});


test('Markdown imports select formatted reading while TXT remains literal', async () => {
	const f = await fixture();
	try {
		f.files.set('/chosen/guide.MD', Buffer.from('# Guide\n**Local**'));
		f.files.set('/chosen/guide.txt', Buffer.from('# Plain'));
		f.select([uri('/chosen/guide.MD'), uri('/chosen/guide.txt')]);
		await f.actions.get('myself.documentation.import')();
		assert.deepEqual(f.state.imports.map(e => e.format), ['markdown', 'text']);
		await f.actions.get('myself.documentation.open')(f.state.imports[0].id); await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).format, 'markdown'); assert.equal(f.sent.at(-1).text, '# Guide\n**Local**');
		await f.actions.get('myself.documentation.open')(f.state.imports[1].id);
		assert.equal(f.sent.at(-1).format, 'text');
	} finally { f.dispose(); }
});

test('previously imported Markdown is formatted without rewriting its saved entry or content', async () => {
	const entry = { id: 'legacy', group: 'imported', title: 'Old guide.md', file: 'imports/abc-def.md', source: '', format: 'text' };
	const f = await fixture({ imports: [entry] });
	try {
		f.files.set('/profile/' + entry.file, Buffer.from('# Legacy'));
		await f.actions.get('myself.documentation.open')(entry.id); await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).format, 'markdown');
		assert.deepEqual(f.state.imports, [entry]); assert.deepEqual(f.writes, []);
	} finally { f.dispose(); }
});


test('imported documentation opens absolute HTTP links only after confirmation', async () => {
	let approve = false; const choices = [];
	const f = await fixture({ confirm: action => { choices.push(action); return approve ? action : undefined; } });
	try {
		f.files.set('/chosen/links.md', Buffer.from('[Reference](https://example.invalid/reference)')); f.select([uri('/chosen/links.md')]);
		await f.actions.get('myself.documentation.import')();
		await f.actions.get('myself.documentation.open')(f.state.imports[0].id);
		await f.message({ type: 'link', href: 'https://example.invalid/reference' });
		assert.deepEqual(f.external, []); assert.equal(choices.at(-1), 'Open in Browser');
		approve = true;
		await f.message({ type: 'link', href: 'https://example.invalid/reference' });
		await f.message({ type: 'link', href: 'http://example.invalid/plain' });
		assert.deepEqual(f.external, ['https://example.invalid/reference', 'http://example.invalid/plain']);
		for (const href of ['file:///etc/passwd', 'command:workbench.action.terminal.new', 'javascript:alert(1)', '../missing.md', '//server/share']) {
			await f.message({ type: 'link', href });
			assert.equal(choices.at(-1), undefined, href);
		}
		assert.equal(f.external.length, 2); assert.deepEqual(f.notices, []);
	} finally { f.dispose(); }
});

test('closing a reader cancels a pending external-link confirmation', async () => {
	let release; const gate = new Promise(resolve => { release = resolve; });
	const f = await fixture({ confirm: () => gate });
	try {
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'link', href: 'https://elsewhere.invalid/reference' });
		f.reader().dispose(); release('Open in Browser'); await tick();
		assert.deepEqual(f.external, []);
	} finally { release?.(); f.dispose(); }
});


test('disposal cancels an open import dialog and queued imports without writing', async () => {
	let release; const gate = new Promise(resolve => { release = resolve; });
	const f = await fixture({ dialog: () => gate });
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide'));
		const first = f.actions.get('myself.documentation.import')(); await tick();
		const second = f.actions.get('myself.documentation.import')();
		f.dispose(); release([uri('/chosen/guide.md')]); await Promise.all([first, second]);
		assert.equal(f.dialogs.length, 1); assert.deepEqual(f.writes, []); assert.deepEqual(f.state.imports, []);
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('disposal during a source read cancels the import before profile writes', async () => {
	let release; const gate = new Promise(resolve => { release = resolve; }); const f = await fixture();
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide')); f.select([uri('/chosen/guide.md')]);
		f.delay(file => file === '/chosen/guide.md' ? gate : undefined);
		const pending = f.actions.get('myself.documentation.import')(); await tick(); f.dispose(); release(); await pending;
		assert.deepEqual(f.writes, []); assert.deepEqual(f.state.imports, []); assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('disposal during a profile write removes the uncommitted copy', async () => {
	let release; const gate = new Promise(resolve => { release = resolve; }); const f = await fixture({ beforeWrite: () => gate });
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide')); f.select([uri('/chosen/guide.md')]);
		const pending = f.actions.get('myself.documentation.import')(); await tick(); assert.equal(f.writes.length, 1);
		f.dispose(); release(); await pending;
		assert.deepEqual(f.state.imports, []); assert.equal(f.files.has(f.writes[0]), false); assert.ok(f.files.has('/chosen/guide.md'));
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('an already-started metadata commit remains paired with its copy after disposal', async () => {
	let release; const gate = new Promise(resolve => { release = resolve; }); const f = await fixture({ beforeUpdate: () => gate });
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide')); f.select([uri('/chosen/guide.md')]);
		const pending = f.actions.get('myself.documentation.import')(); await tick(); assert.equal(f.writes.length, 1);
		f.dispose(); release(); await pending;
		assert.equal(f.state.imports.length, 1); assert.ok(f.files.has('/profile/' + f.state.imports[0].file));
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('failed metadata persistence removes only the new copy and permits a later import', async () => {
	let fail = true; const f = await fixture({ beforeUpdate: () => { if (fail) { throw new Error('storage failure'); } } });
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide')); f.select([uri('/chosen/guide.md')]);
		await f.actions.get('myself.documentation.import')();
		assert.deepEqual(f.state.imports, []); assert.equal(f.files.has(f.writes[0]), false); assert.ok(f.files.has('/chosen/guide.md'));
		assert.equal(f.notices.length, 1);
		fail = false; await f.actions.get('myself.documentation.import')();
		assert.equal(f.state.imports.length, 1); assert.ok(f.files.has('/profile/' + f.state.imports[0].file));
	} finally { f.dispose(); }
});


test('a failed profile write leaves no entry and does not break the import queue', async () => {
	let fail = true; const f = await fixture({ beforeWrite: () => { if (fail) { throw new Error('disk failure'); } } });
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide')); f.select([uri('/chosen/guide.md')]);
		await f.actions.get('myself.documentation.import')();
		assert.deepEqual(f.state.imports, []); assert.equal(f.files.has(f.writes[0]), false); assert.ok(f.files.has('/chosen/guide.md'));
		fail = false; await f.actions.get('myself.documentation.import')();
		assert.equal(f.state.imports.length, 1); assert.ok(f.files.has('/profile/' + f.state.imports[0].file));
	} finally { f.dispose(); }
});

test('failed removal persistence preserves the existing copy and disposed removal does nothing', async () => {
	let fail = false; const f = await fixture({ beforeUpdate: () => { if (fail) { throw new Error('storage failure'); } } });
	try {
		f.files.set('/chosen/guide.md', Buffer.from('# Guide')); f.select([uri('/chosen/guide.md')]);
		await f.actions.get('myself.documentation.import')(); const entry = f.state.imports[0];
		fail = true; await assert.rejects(f.actions.get('myself.documentation.remove')(entry), /storage failure/);
		assert.deepEqual(f.state.imports, [entry]); assert.ok(f.files.has('/profile/' + entry.file));
		fail = false; f.dispose(); await f.actions.get('myself.documentation.remove')(entry);
		assert.deepEqual(f.state.imports, [entry]); assert.ok(f.files.has('/profile/' + entry.file));
	} finally { f.dispose(); }
});


test('folder import preserves internal links and rolls back a failed metadata commit', async () => {
	const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
	const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'myself-library-set-'));
	let fail = false; const f = await fixture({ beforeUpdate: () => { if (fail) { throw new Error('storage'); } } });
	try {
		await fs.mkdir(path.join(folder, 'chapters'));
		await fs.writeFile(path.join(folder, 'index.md'), '# Index\n[Next](chapters/one.md#intro)');
		await fs.writeFile(path.join(folder, 'chapters/one.md'), '# Intro');
		f.select([uri(folder)]); await f.actions.get('myself.documentation.importFolder')();
		assert.equal(f.state.imports.length, 2);
		const entries = [...f.state.imports], index = entries.find(e => e.importPath === 'index.md');
		assert.equal(entries[0].collection, entries[1].collection);
		const groups = await f.provider.getChildren({ id: 'imported' });
		assert.equal(groups.length, 1); assert.equal(groups[0].title, path.basename(folder));
		assert.equal((await f.provider.getChildren(groups[0])).length, 2);
		const reopened = await fixture({ imports: entries });
		try {
			for (const entry of entries) { reopened.files.set('/profile/' + entry.file, f.files.get('/profile/' + entry.file)); }
			await reopened.actions.get('myself.documentation.open')(index.id); await reopened.message({ type: 'ready' });
			await reopened.message({ type: 'link', href: 'chapters/one.md#intro' }, true);
			assert.equal(reopened.sent.at(-1).text, '# Intro');
		} finally { reopened.dispose(); }
		await f.actions.get('myself.documentation.open')(index.id); await f.message({ type: 'ready' });
		await f.message({ type: 'link', href: 'chapters/one.md#intro' }, true);
		assert.equal(f.sent.at(-1).text, '# Intro'); assert.equal(f.sent.at(-1).fragment, 'intro'); assert.deepEqual(f.external, []);
		const before = new Set(f.files.keys()); fail = true;
		await f.actions.get('myself.documentation.importFolder')();
		assert.deepEqual(f.state.imports, entries); assert.deepEqual(new Set(f.files.keys()), before);
		assert.equal(await fs.readFile(path.join(folder, 'index.md'), 'utf8'), '# Index\n[Next](chapters/one.md#intro)');
	} finally { f.dispose(); await fs.rm(folder, { recursive: true, force: true }); }
});


test('folder import rolls back copies when disposed during a write', async () => {
	const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
	const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'myself-library-cancel-'));
	let release, entered;
	const gate = new Promise(resolve => { release = resolve; }); const writing = new Promise(resolve => { entered = resolve; });
	const f = await fixture({ beforeWrite: () => { entered(); return gate; } });
	try {
		await fs.writeFile(path.join(folder, 'one.md'), '# One'); f.select([uri(folder)]);
		const pending = f.actions.get('myself.documentation.importFolder')(); await writing;
		f.dispose(); release(); await pending;
		assert.deepEqual(f.state.imports, []); assert.ok(f.writes.every(file => !f.files.has(file))); assert.deepEqual(f.notices, []);
		assert.equal(await fs.readFile(path.join(folder, 'one.md'), 'utf8'), '# One');
	} finally { release?.(); f.dispose(); await fs.rm(folder, { recursive: true, force: true }); }
});

test('Back skips a removed article and opens the previous available one', async () => {
	const f = await fixture();
	try {
		f.files.set('/chosen/removed.html', Buffer.from('<h1>Removed</h1>'));
		f.select([uri('/chosen/removed.html')]);
		await f.actions.get('myself.documentation.import')();
		const imported = f.state.imports[0];
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' });
		await f.actions.get('myself.documentation.open')(imported.id);
		await f.actions.get('myself.documentation.open')('two');
		await f.actions.get('myself.documentation.remove')(imported);
		await f.message({ type: 'back' }, true);
		assert.equal(f.sent.at(-1).title, 'One');
		assert.equal(f.sent.at(-1).back, false);
	} finally { f.dispose(); }
});

for (const hidden of [false, true]) {
	test(`removing the last history entry updates Back without resending the article (hidden: ${hidden})`, async () => {
		const f = await fixture();
		try {
			f.files.set('/chosen/removed.html', Buffer.from('<h1>Removed</h1>'));
			f.select([uri('/chosen/removed.html')]);
			await f.actions.get('myself.documentation.import')();
			const imported = f.state.imports[0];
			await f.actions.get('myself.documentation.open')(imported.id);
			await f.message({ type: 'ready' });
			await f.actions.get('myself.documentation.open')('two');
			const current = f.sent.at(-1);
			assert.equal(current.title, 'Two');
			assert.equal(current.back, true);
			if (hidden) {
				f.reader().setVisible(false);
			}
			await f.actions.get('myself.documentation.remove')(imported);
			if (hidden) {
				assert.equal(f.sent.at(-1), current);
				f.reader().setVisible(true);
				await tick();
			}
			assert.deepEqual(f.sent.slice(1), [current, { type: 'backState', back: false }]);
			await f.message({ type: 'back' });
			assert.equal(f.sent.length, 3);
			await f.message({ type: 'ready' });
			assert.deepEqual(f.sent.at(-1), { ...current, back: false });
		} finally { f.dispose(); }
	});
}

test('removing an imported article during a Back read leaves the current article visible', async () => {
	const f = await fixture();
	let release;
	try {
		f.files.set('/chosen/removed.html', Buffer.from('<h1>Removed</h1>'));
		f.select([uri('/chosen/removed.html')]);
		await f.actions.get('myself.documentation.import')();
		const imported = f.state.imports[0];
		await f.actions.get('myself.documentation.open')(imported.id);
		await f.message({ type: 'ready' });
		await f.actions.get('myself.documentation.open')('two');
		const gate = new Promise(resolve => { release = resolve; });
		const entered = deferred();
		f.delay(file => { if (file.endsWith(imported.file)) { entered.resolve(); return gate; } });
		await f.message({ type: 'back' });
		await entered.promise;
		assert.equal(f.reads.at(-1), '/profile/' + imported.file);
		await f.actions.get('myself.documentation.remove')(imported);
		release();
		await tick();
		assert.deepEqual(f.sent.at(-1), { type: 'backState', back: false });
		assert.deepEqual(f.sent.filter(message => message.type === 'document').map(message => message.title), ['removed.html', 'Two']);
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('the enabled resource VSIX takes precedence; test builds fall back to their bundled snapshot', async () => {
	const f = await fixture({ installed: true });
	try {
		assert.deepEqual(f.provider.getChildren().map(group => group.title), ['VSIX Test', 'My Documents']);
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).text, '<h1>VSIX One</h1>');
		assert.deepEqual(f.reads, ['catalog.json', 'test/one.html'].map(file => path.join(f.installedRoot, 'documentation', file)));
		f.change();
		assert.equal(f.provider.getChildren()[0].title, 'VSIX Test');
		assert.equal(f.reads.length, 2, 'unrelated extension changes keep the active snapshot');

		f.setInstalled(undefined);
		await f.waitForTreeChange();
		assert.deepEqual(f.sent.at(-1), { type: 'clear', back: false });
		assert.deepEqual(f.provider.getChildren().map(group => group.title), ['Test', 'My Documents']);
		await f.actions.get('myself.documentation.open')('one');
		assert.equal(f.sent.at(-1).text, '<h1>One</h1>');
	} finally { f.dispose(); }
});

test('a standalone reader loads personal imports while a catalog is pending or absent', async () => {
	const entry = { id: 'legacy', group: 'imported', title: 'Personal', file: 'imports/abc-def.md', source: '', format: 'text' };
	const entered = deferred(), release = deferred();
	const f = await fixture({
		bundled: false, installed: true, deferCatalog: true, imports: [entry],
		beforeRead: file => { if (file.endsWith('catalog.json')) { entered.resolve(); return release.promise; } },
	});
	try {
		f.files.set('/profile/' + entry.file, Buffer.from('# Personal'));
		await entered.promise;
		const [personal] = f.provider.getChildren();
		assert.equal(personal.id, 'imported');
		assert.deepEqual(f.provider.getChildren(personal), [entry]);
		await f.actions.get('myself.documentation.open')(entry.id);
		await f.message({ type: 'ready' });
		const initial = f.sent.at(-1);
		assert.equal(initial.text, '# Personal');

		const stale = f.actions.get('myself.documentation.open')('one');
		const settled = f.waitForTreeChange();
		f.setInstalled(undefined);
		await settled;
		release.resolve();
		await stale;
		assert.deepEqual(f.provider.getChildren().map(group => group.title), ['My Documents']);
		assert.deepEqual(f.sent, [initial]);
		assert.deepEqual(f.notices, []);
		assert.deepEqual(f.state.imports, [entry]);
	} finally { release.resolve(); f.dispose(); }
});

test('install and re-enable repopulate a standalone reader; removal clears an official article after visibility and ready', async () => {
	const entry = { id: 'legacy', group: 'imported', title: 'Personal', file: 'imports/abc-def.md', source: '', format: 'text' };
	const f = await fixture({ bundled: false, imports: [entry] });
	try {
		assert.deepEqual(f.provider.getChildren().map(group => group.title), ['My Documents']);
		f.writeCatalog(f.installedRoot, 'VSIX ');
		f.setInstalled(uri(f.installedRoot));
		await f.waitForTreeChange();
		assert.deepEqual(f.provider.getChildren().map(group => group.title), ['VSIX Test', 'My Documents']);

		f.files.set('/profile/' + entry.file, Buffer.from('# Personal'));
		await f.actions.get('myself.documentation.open')(entry.id);
		await f.actions.get('myself.documentation.open')('one');
		f.reader().setVisible(false);
		f.setInstalled(undefined);
		await f.waitForTreeChange();
		await f.message({ type: 'ready' });
		assert.deepEqual(f.sent, []);
		f.reader().setVisible(true);
		await tick();
		assert.deepEqual(f.sent, [{ type: 'clear', back: true }]);
		await f.message({ type: 'source' });
		assert.deepEqual(f.external, []);
		await f.message({ type: 'back' }, true);
		assert.equal(f.sent.at(-1).text, '# Personal');

		f.setInstalled(uri(f.installedRoot));
		await f.waitForTreeChange();
		await f.actions.get('myself.documentation.open')('two');
		assert.equal(f.sent.at(-1).text, '<h1>VSIX Two</h1>');
	} finally { f.dispose(); }
});

test('removal abandons a late official read and updates Back without resending the personal document', async () => {
	const f = await fixture({ bundled: false, installed: true });
	const entered = deferred(), release = deferred();
	try {
		f.files.set('/chosen/personal.md', Buffer.from('# Personal'));
		f.select([uri('/chosen/personal.md')]);
		await f.actions.get('myself.documentation.import')();
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' });
		await f.actions.get('myself.documentation.open')(f.state.imports[0].id);
		const current = f.sent.at(-1);
		assert.equal(current.back, true);

		f.delay(file => { if (file.endsWith('two.html')) { entered.resolve(); return release.promise; } });
		const stale = f.actions.get('myself.documentation.open')('two');
		await entered.promise;
		const settled = f.waitForTreeChange();
		f.setInstalled(undefined);
		await settled;
		release.resolve();
		await stale;
		assert.deepEqual(f.sent.slice(1), [current, { type: 'backState', back: false }]);
		assert.deepEqual(f.notices, []);
		assert.equal(f.opened.length, 1);
		assert.equal(f.state.imports.length, 1);
	} finally { release.resolve(); f.dispose(); }
});

test('a late article from a disabled snapshot stays stale after that same VSIX is enabled again', async () => {
	const f = await fixture({ bundled: false, installed: true });
	const entered = deferred(), release = deferred();
	try {
		f.delay(file => { if (file.endsWith('one.html')) { entered.resolve(); return release.promise; } });
		const stale = f.actions.get('myself.documentation.open')('one');
		await entered.promise;
		const disabled = f.waitForTreeChange();
		f.setInstalled(undefined);
		await disabled;
		f.setInstalled(uri(f.installedRoot));
		await f.waitForTreeChange();
		release.resolve();
		await stale;
		assert.equal(f.reader(), undefined);
		assert.deepEqual(f.notices, []);
		await f.actions.get('myself.documentation.open')('two');
		await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).text, '<h1>VSIX Two</h1>');
	} finally { release.resolve(); f.dispose(); }
});

test('a malformed or oversized installed catalog leaves personal imports available', async () => {
	for (const bytes of [Buffer.from('{'), Buffer.alloc(maxCatalogBytes + 1)]) {
		const f = await fixture({ installed: true, prepare: ({ installedRoot }) => fs.writeFileSync(path.join(installedRoot, 'documentation/catalog.json'), bytes) });
		try {
			assert.deepEqual(f.provider.getChildren().map(group => group.id), ['imported']);
			assert.deepEqual(f.notices, ['The local documentation catalog could not be loaded.']);
			f.files.set('/chosen/personal.md', Buffer.from('# Personal'));
			f.select([uri('/chosen/personal.md')]);
			await f.actions.get('myself.documentation.import')();
			await f.actions.get('myself.documentation.open')(f.state.imports[0].id);
			await f.message({ type: 'ready' });
			assert.equal(f.sent.at(-1).text, '# Personal');
		} finally { f.dispose(); }
	}
});

test('catalog/article links, redirected article folders, non-local roots and oversized articles are rejected', async () => {
	const f = await fixture({ bundled: false, installed: true });
	try {
		const docs = path.join(f.installedRoot, 'documentation');
		const group = path.join(docs, 'test');
		const outside = path.join(f.root, 'outside');
		fs.renameSync(group, outside);
		fs.symlinkSync(outside, group, 'junction');
		await f.actions.get('myself.documentation.open')('one');
		fs.unlinkSync(group);
		fs.renameSync(outside, group);
		const article = path.join(group, 'one.html');
		fs.renameSync(article, outside);
		fs.symlinkSync(outside, article, 'file');
		await f.actions.get('myself.documentation.open')('one');
		fs.unlinkSync(article);
		fs.writeFileSync(article, Buffer.alloc(maxDocumentBytes + 1));
		await f.actions.get('myself.documentation.open')('one');
		assert.equal(f.reader(), undefined);
		assert.equal(f.notices.length, 3);

		const remote = f.waitForTreeChange();
		f.setInstalled({ ...uri(f.installedRoot + '/remote'), authority: 'server' });
		await remote;
		assert.deepEqual(f.provider.getChildren().map(group => group.id), ['imported']);
		const catalog = path.join(docs, 'catalog.json');
		const externalCatalog = path.join(f.root, 'outside.json');
		fs.renameSync(catalog, externalCatalog);
		fs.symlinkSync(externalCatalog, catalog, 'file');
		f.setInstalled(uri(f.installedRoot));
		await f.waitForTreeChange();
		assert.deepEqual(f.provider.getChildren().map(group => group.id), ['imported']);
		assert.deepEqual(f.notices.slice(3), Array(2).fill('The local documentation catalog could not be loaded.'));
	} finally { f.dispose(); }
});

test('an update at the same path invalidates official search results but preserves personal selections', async () => {
	const entry = { id: 'legacy', group: 'imported', title: 'Personal', file: 'imports/abc-def.md', source: '', format: 'text' };
	let choose, choices;
	const f = await fixture({
		bundled: false, installed: true, imports: [entry],
		quickPick: items => { choices = items; return new Promise(resolve => { choose = resolve; }); },
	});
	try {
		f.files.set('/profile/' + entry.file, Buffer.from('# Personal'));
		const search = () => f.actions.get('myself.documentation.search')();
		const official = search();
		const old = choices.find(item => item.label === 'One');
		f.writeCatalog(f.installedRoot, 'Updated ');
		f.setInstalled(uri(f.installedRoot), '2');
		await f.waitForTreeChange();
		assert.equal(f.provider.getChildren()[0].title, 'Updated Test');
		choose(old);
		await official;
		assert.equal(f.reader(), undefined);

		const personal = search();
		const local = choices.find(item => item.label === 'Personal');
		const removed = f.waitForTreeChange();
		f.setInstalled(undefined);
		await removed;
		choose(local);
		await personal;
		await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).text, '# Personal');
	} finally { f.dispose(); }
});

test('full-text scan reads the final catalog document and local imports without following links', async () => {
	const imported = { id: 'personal', group: 'imported', title: 'Personal', file: 'imports/d1.md', source: '', format: 'markdown' };
	const f = await fixture({ imports: [imported], prepare({ bundled, root, catalog }) {
		const dir = path.join(bundled, 'documentation');
		for (let i = 0; i < 39; i++) {
			const file = `test/item-${i}.html`;
			catalog.entries.push({ id: 'item-' + i, group: 'test', title: 'Item ' + i, file, source: '', format: 'html' });
			fs.writeFileSync(path.join(dir, file), i === 38 ? '<p>Last page</p><a href="https://outside.invalid/">Link</a>' : '<p>Earlier page</p>');
		}
		catalog.entries.push({ id: 'alias', group: 'test', title: 'Alias', file: 'test/alias.html', source: '', format: 'html' });
		fs.writeFileSync(path.join(root, 'outside.html'), 'must never be read');
		fs.symlinkSync(path.join(root, 'outside.html'), path.join(dir, 'test/alias.html'));
		fs.writeFileSync(path.join(dir, 'test/unlisted.html'), '<p>Unlisted</p>');
		fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog));
	} });
	try {
		f.files.set('/profile/' + imported.file, Buffer.from('Imported body'));
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' }, true);
		f.reads.length = 0;
		await f.message({ type: 'librarySearchStart', id: 1, query: 'Last page' }, true);
		const first = f.sent.at(-1);
		assert.deepEqual([first.type, first.offset, first.done, f.reads.length], ['librarySearchBatch', 32, false, 32]);
		await f.message({ type: 'librarySearchNext', id: 1, batch: 0 });
		assert.equal(f.reads.length, 32);
		await f.message({ type: 'librarySearchNext', id: 1, batch: 1 }, true);
		const last = f.sent.at(-1);
		assert.deepEqual([last.offset, last.total, last.skipped, last.done], [43, 43, 1, true]);
		assert.ok(last.documents.some(entry => entry.text.includes('Last page')));
		assert.equal(last.documents.at(-1).text, 'Imported body');
		assert.ok(!f.reads.some(file => /outside|alias|unlisted/.test(file)));
		assert.deepEqual(f.external, []);
		await f.message({ type: 'librarySearchOpen', id: 1, index: -1 });
		assert.equal(f.sent.at(-1), last);
		await f.message({ type: 'librarySearchOpen', id: 1, index: 40 }, true);
		assert.deepEqual([f.sent.at(-1).type, f.sent.at(-1).title], ['document', 'Item 38']);
	} finally { f.dispose(); }
});

test('cancelling or replacing a scan discards its in-flight batch and serializes reads', async () => {
	const f = await fixture();
	try {
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' }, true);
		f.reads.length = 0;
		const entered = deferred(), release = deferred();
		f.delay(file => { if (file.endsWith('test/one.html')) { entered.resolve(); return release.promise; } });
		await f.message({ type: 'librarySearchStart', id: 1, query: 'one' });
		await entered.promise;
		await f.message({ type: 'librarySearchCancel', id: 1 });
		await f.message({ type: 'librarySearchStart', id: 2, query: 'two' });
		assert.equal(f.reads.length, 1);
		f.delay(undefined);
		release.resolve();
		const posted = deferred();
		const originalPost = f.reader().webview.postMessage;
		f.reader().webview.postMessage = async message => { posted.resolve(message); return originalPost(message); };
		const latest = await posted.promise;
		assert.deepEqual([latest.type, latest.id, latest.done, f.reads.length], ['librarySearchBatch', 2, true, 3]);
		assert.ok(!f.sent.some(message => message.type === 'librarySearchBatch' && message.id === 1));
		await f.message({ type: 'librarySearchOpen', id: 1, index: 1 });
		assert.equal(f.sent.at(-1), latest);
	} finally { f.dispose(); }
});

test('switching library snapshots invalidates search and prevents opening stale result indices', async () => {
	const f = await fixture({ installed: true });
	try {
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' }, true);
		await f.message({ type: 'librarySearchStart', id: 1, query: 'One' }, true);
		const updated = f.waitForTreeChange();
		f.setInstalled(uri(f.installedRoot), '2');
		await updated;
		await tick();
		assert.ok(f.sent.some(message => message.type === 'librarySearchInvalidated' && message.id === 1));
		const reads = f.reads.length;
		await f.message({ type: 'librarySearchOpen', id: 1, index: 0 });
		assert.equal(f.reads.length, reads);
	} finally { f.dispose(); }
});

test('full-text scan skips a linked import and completes an oversized batch without truncating the next document', async () => {
	const imported = { id: 'personal', group: 'imported', title: 'Personal', file: 'imports/d1.md', source: '', format: 'markdown' };
	const f = await fixture({ imports: [imported], prepare({ bundled, root }) {
		const dir = path.join(root, 'profile/imports');
		fs.mkdirSync(dir);
		fs.writeFileSync(path.join(root, 'outside.txt'), 'outside');
		fs.symlinkSync(path.join(root, 'outside.txt'), path.join(dir, 'd1.md'));
		fs.writeFileSync(path.join(bundled, 'documentation/test/one.html'), '<p>' + 'large '.repeat(50_000) + '</p>');
	} });
	try {
		await f.actions.get('myself.documentation.open')('two');
		await f.message({ type: 'ready' }, true);
		f.reads.length = 0;
		await f.message({ type: 'librarySearchStart', id: 1, query: 'x'.repeat(257) });
		assert.equal(f.reads.length, 0);
		await f.message({ type: 'librarySearchStart', id: 2, query: 'Two' }, true);
		assert.deepEqual([f.sent.at(-1).offset, f.sent.at(-1).documents.length, f.sent.at(-1).done], [1, 1, false]);
		await f.message({ type: 'librarySearchNext', id: 2, batch: 1 }, true);
		const final = f.sent.at(-1);
		assert.deepEqual([final.offset, final.done, final.skipped, final.documents[0].text], [3, true, 1, '<h1>Two</h1>']);
		assert.ok(!f.reads.some(file => /d1\.md|outside\.txt/.test(file)));
	} finally { f.dispose(); }
});

function selectText(anchorOffset, activeOffset = anchorOffset) {
	const position = offset => ({ offset, isEqual: other => other.offset === offset });
	return {
		anchor: position(anchorOffset),
		active: position(activeOffset),
		start: position(Math.min(anchorOffset, activeOffset)),
		end: position(Math.max(anchorOffset, activeOffset)),
		isEmpty: anchorOffset === activeOffset,
	};
}

function contextEditor(languageId, text, selection = selectText(0, text.length)) {
	return {
		selection,
		document: {
			languageId,
			version: 1,
			offsetAt: position => position.offset,
			getText: range => text.slice(range.start.offset, range.end.offset),
			getWordRangeAtPosition: (position, pattern) => {
				const match = Array.from(text.matchAll(new RegExp(pattern))).find(match => match.index <= position.offset && position.offset <= match.index + match[0].length);
				return match && selectText(match.index, match.index + match[0].length);
			},
		},
	};
}

const contextDocuments = [
	['go/go-spec.html', 'Go Specification'],
	['rust/rust-reference.html', 'Rust Reference'],
	['postgresql/index.html', 'PostgreSQL'],
	['postgresql/sql-select.html', 'SELECT'],
	['postgresql/sql-createtable.html', 'CREATE TABLE'],
	['bash/bash.html', 'Bash Manual'],
];

function writeContextCatalog(bundled, catalog, documents = contextDocuments) {
	const documentation = path.join(bundled, 'documentation');
	for (const [file, title] of documents) {
		const group = file.split('/')[0];
		if (!catalog.groups.some(entry => entry.id === group)) {
			catalog.groups.push({ id: group, title: group, version: '', license: '' });
		}
		catalog.entries.push({ id: 'fixture-' + file, group, file, title, format: 'html', source: '' });
		fs.mkdirSync(path.dirname(path.join(documentation, file)), { recursive: true });
		fs.writeFileSync(path.join(documentation, file), '<h1>' + title + '</h1><h2 id="Map_types">Map types</h2>');
	}
	fs.writeFileSync(path.join(documentation, 'catalog.json'), JSON.stringify(catalog));
}

test('context help opens vetted Go and SQL topics in the right reader and ignores invocation arguments', async () => {
	const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
	try {
		const help = f.actions.get('myself.documentation.contextHelp');
		f.setEditor(contextEditor('go', 'x := map[string]int{}', selectText(6)));
		await help('postgresql/sql-select.html', 'https://outside.invalid/#unsafe');
		await f.message({ type: 'ready' }, true);
		assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).fragment], ['Go Specification', 'Map_types']);
		assert.deepEqual(f.opened, [['myself.documentation.reader.open', { preserveFocus: true }]]);

		for (const [term, selection, title] of [
			['select', selectText(3), 'SELECT'],
			['Create\n TABLE', selectText(0, 13), 'CREATE TABLE'],
			['create table t', selectText(9), 'CREATE TABLE'],
		]) {
			f.setEditor(contextEditor('sql', term, selection));
			await help();
			assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).fragment], [title, '']);
		}
		assert.deepEqual(f.external, []);
		assert.deepEqual(f.information, []);
	} finally { f.dispose(); }
});

test('unknown terms and unsuitable selection sizes fall back to the language reference', async () => {
	const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
	try {
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' }, true);
		const help = f.actions.get('myself.documentation.contextHelp');
		for (const [language, text, title] of [
			['go', 'Map', 'Go Specification'],
			['go', 'αmap', 'Go Specification'],
			['go', 'https://outside.invalid/map', 'Go Specification'],
			['sql', 'CREATE TABLESPACE', 'PostgreSQL'],
			['rust', 'arbitrary', 'Rust Reference'],
			['shellscript', 'arbitrary', 'Bash Manual'],
		]) {
			f.setEditor(contextEditor(language, text));
			await help();
			assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).fragment], [title, '']);
		}
		const editor = contextEditor('go', 'x'.repeat(65));
		editor.document.getText = () => assert.fail('oversized selection must not be read');
		f.setEditor(editor);
		await help();
		assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).fragment], ['Go Specification', '']);
		assert.deepEqual(f.external, []);
	} finally { f.dispose(); }
});

test('context help reports no editor, unsupported language and missing local documentation without opening a view', async () => {
	const f = await fixture({ bundled: false });
	try {
		const help = f.actions.get('myself.documentation.contextHelp');
		await help('go', 'map');
		f.setEditor(contextEditor('plaintext', 'map'));
		await help('go', 'map');
		f.setEditor(contextEditor('go', 'map'));
		await help();
		assert.deepEqual(f.information, [
			'Open a text editor to use local context help.',
			'Local context help is available for Go, Rust, SQL and shell scripts.',
			'Local documentation for this language is unavailable.',
		]);
		assert.deepEqual([f.opened, f.reads, f.external], [[], [], []]);
	} finally { f.dispose(); }
});

test('an exact topic missing from the snapshot falls back only to a vetted reference in that snapshot', async () => {
	const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog, [
		['postgresql/index.html', 'PostgreSQL'],
	]) });
	try {
		f.setEditor(contextEditor('sql', 'SELECT'));
		await f.actions.get('myself.documentation.contextHelp')();
		await f.message({ type: 'ready' }, true);
		assert.equal(f.sent.at(-1).title, 'PostgreSQL');
		assert.equal(f.reads.at(-1), path.join(f.bundled, 'documentation/postgresql/index.html'));
		assert.deepEqual(f.external, []);
	} finally { f.dispose(); }
});

test('changing selection while catalog loading discards the request before any article read', async () => {
	const entered = deferred(), release = deferred();
	const f = await fixture({
		deferCatalog: true,
		prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog),
		beforeRead: file => { if (file.endsWith('catalog.json')) { entered.resolve(); return release.promise; } },
	});
	try {
		await entered.promise;
		const editor = contextEditor('go', 'map name', selectText(0, 3));
		f.setEditor(editor);
		const requested = f.actions.get('myself.documentation.contextHelp')();
		editor.selection = selectText(4, 8);
		release.resolve();
		await requested;
		assert.deepEqual(f.reads, [path.join(f.bundled, 'documentation/catalog.json')]);
		assert.deepEqual([f.opened, f.information], [[], []]);
	} finally { release.resolve(); f.dispose(); }
});

test('a stale article completion cannot replace help for the latest selection', async () => {
	const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
	const entered = deferred(), release = deferred();
	try {
		const editor = contextEditor('sql', 'SELECT CREATE TABLE', selectText(0, 6));
		f.setEditor(editor);
		f.delay(file => { if (file.endsWith('sql-select.html')) { entered.resolve(); return release.promise; } });
		const help = f.actions.get('myself.documentation.contextHelp');
		const firstRequest = help();
		await entered.promise;
		editor.selection = selectText(7, 19);
		await help();
		await f.message({ type: 'ready' }, true);
		release.resolve();
		await firstRequest;
		assert.deepEqual(f.sent.filter(message => message.type === 'document').map(message => message.title), ['CREATE TABLE']);
		assert.deepEqual(f.opened, [['myself.documentation.reader.open', { preserveFocus: true }]]);
		assert.deepEqual(f.notices, []);
	} finally { release.resolve(); f.dispose(); }
});

for (const [change, update] of [
	['document version', editor => { editor.document.version++; }],
	['selection', editor => { editor.selection = selectText(0); }],
]) {
	test(`changing the ${change} during a context help read discards it`, async () => {
		const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
		const entered = deferred(), release = deferred();
		try {
			const editor = contextEditor('go', 'map');
			f.setEditor(editor);
			f.delay(file => { if (file.endsWith('go-spec.html')) { entered.resolve(); return release.promise; } });
			const requested = f.actions.get('myself.documentation.contextHelp')();
			await entered.promise;
			update(editor);
			release.resolve();
			await requested;
			assert.deepEqual([f.opened, f.sent, f.notices], [[], [], []]);
		} finally { release.resolve(); f.dispose(); }
	});
}

for (const timing of ['before', 'after']) {
	test(`a stale context article is discarded when ready arrives ${timing} the reveal command settles`, async () => {
		const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
		const entered = deferred(), release = deferred();
		try {
			f.setEditor(contextEditor('go', 'map'));
			f.delayReveal(open => { open(); entered.resolve(); return release.promise; });
			const requested = f.actions.get('myself.documentation.contextHelp')();
			await entered.promise;
			if (timing === 'after') {
				release.resolve();
				await requested;
			}
			f.setEditor(contextEditor('sql', 'SELECT'));
			await f.message({ type: 'ready' });
			release.resolve();
			await requested;
			assert.deepEqual(f.sent, []);
		} finally { release.resolve(); f.dispose(); }
	});

	test(`a stale context article preserves the previous article when visibility changes ${timing} the reveal command settles`, async () => {
		const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
		const entered = deferred(), release = deferred();
		try {
			await f.actions.get('myself.documentation.open')('one');
			await f.message({ type: 'ready' }, true);
			f.reader().setVisible(false);

			const editor = contextEditor('go', 'map');
			f.setEditor(editor);
			f.delayReveal(() => { entered.resolve(); return release.promise; });
			const requested = f.actions.get('myself.documentation.contextHelp')();
			await entered.promise;
			if (timing === 'after') {
				release.resolve();
				await requested;
			}
			editor.selection = selectText(0);
			f.reader().setVisible(true);
			await tick();
			release.resolve();
			await requested;

			assert.deepEqual(f.sent.map(({ type, title, back }) => [type, title, back]), [['document', 'One', false]]);
		} finally { release.resolve(); f.dispose(); }
	});
}

test('a current context result commits once after reveal and retains Back to the previous article', async () => {
	const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
	const entered = deferred(), release = deferred();
	try {
		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' }, true);
		f.reader().setVisible(false);

		f.setEditor(contextEditor('go', 'map'));
		f.delayReveal(open => { open(); entered.resolve(); return release.promise; });
		const requested = f.actions.get('myself.documentation.contextHelp')();
		await entered.promise;
		await f.message({ type: 'ready' }, true);
		assert.ok(f.sent.every(({ title }) => title === 'One'));
		release.resolve();
		await requested;
		const topics = f.sent.filter(({ title }) => title === 'Go Specification');
		assert.equal(topics.length, 1);
		assert.deepEqual([topics[0].fragment, topics[0].back], ['Map_types', true]);

		await f.message({ type: 'back' }, true);
		assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).back], ['One', false]);
	} finally { release.resolve(); f.dispose(); }
});

test('a failed context delivery is revalidated before a later ready message', async () => {
	const f = await fixture({ prepare: ({ bundled, catalog }) => writeContextCatalog(bundled, catalog) });
	try {
		const editor = contextEditor('go', 'map');
		f.setEditor(editor);
		await f.actions.get('myself.documentation.contextHelp')();
		const post = f.reader().webview.postMessage;
		f.reader().webview.postMessage = async () => false;
		await f.message({ type: 'ready' });

		editor.document.version++;
		f.reader().webview.postMessage = post;
		await f.message({ type: 'ready' });
		assert.deepEqual(f.sent, []);
	} finally { f.dispose(); }
});

const pdfFixture = Buffer.from('%PDF-1.7\n%\xff\xfe\nfixture bytes\n%%EOF\n', 'latin1');

function writePdfFixture(f, name = 'Synthetic.PDF') {
	const original = path.join(f.root, name);
	fs.writeFileSync(original, pdfFixture);
	return original;
}

test('an explicitly imported PDF is listed, keeps its bytes and never enters the preview or full-text reader', async () => {
	const f = await fixture({
		quickPick: items => items.find(item => item.entry.format === 'pdf'),
	});
	try {
		const original = writePdfFixture(f);
		f.select([uri(original)]);
		await f.actions.get('myself.documentation.importPdf')('https://outside.invalid/fake.pdf');
		const [entry] = f.state.imports;
		const copy = path.join(f.root, 'profile', entry.file);
		assert.deepEqual([entry.group, entry.format, entry.title, entry.source], ['imported', 'pdf', 'Synthetic.PDF', '']);
		assert.match(entry.id, /^[a-f0-9-]{36}$/);
		assert.equal(entry.file, `pdf-imports/${entry.id}.pdf`);
		assert.equal(entry.sha256, createHash('sha256').update(pdfFixture).digest('hex'));
		assert.deepEqual(fs.readFileSync(copy), pdfFixture);
		assert.deepEqual(fs.readFileSync(original), pdfFixture);
		assert.deepEqual(f.dialogOptions, [{
			canSelectFiles: true, canSelectFolders: false, canSelectMany: false, filters: { PDF: ['pdf'] }, openLabel: 'Add PDF to Local Library',
		}]);

		const [listed] = f.provider.getChildren({ id: 'imported' });
		const treeItem = f.provider.getTreeItem(listed);
		assert.deepEqual([listed, treeItem.description, treeItem.iconPath.id, treeItem.command.arguments], [entry, 'PDF', 'file-pdf', [entry.id]]);
		const before = f.reads.length;
		await f.actions.get('myself.documentation.open')(original);
		await f.actions.get(treeItem.command.command)(...treeItem.command.arguments);
		await f.actions.get('myself.documentation.search')();
		const unavailable = 'A verified built-in preview is not yet available for PDFs in the library.';
		assert.deepEqual([f.information, f.opened, f.external, f.reads.length], [[unavailable, unavailable], [], [], before]);

		await f.actions.get('myself.documentation.open')('one');
		await f.message({ type: 'ready' }, true);
		f.reads.length = 0;
		await f.message({ type: 'librarySearchStart', id: 1, query: 'fixture' }, true);
		assert.deepEqual([f.sent.at(-1).total, f.sent.at(-1).skipped, f.sent.at(-1).documents.map(document => document.title)], [2, 0, ['One', 'Two']]);
		assert.ok(f.reads.every(file => file.endsWith('.html')));
	} finally { f.dispose(); }
});

test('PDF import rejects nonlocal, nonregular, linked, oversized and mislabeled selections', async () => {
	const f = await fixture();
	try {
		const source = writePdfFixture(f, 'Source.pdf');
		const linked = path.join(f.root, 'Link.pdf');
		const folder = path.join(f.root, 'Directory.pdf');
		const wrong = path.join(f.root, 'HTML.pdf');
		const large = writePdfFixture(f, 'Large.pdf');
		fs.symlinkSync(source, linked);
		fs.mkdirSync(folder);
		fs.writeFileSync(wrong, '<html>This is not a PDF</html>');
		fs.truncateSync(large, maxDocumentBytes + 1);

		const importPdf = f.actions.get('myself.documentation.importPdf');
		await importPdf();
		f.select([uri(source), uri(large)]);
		await importPdf();
		assert.deepEqual(f.notices, []);

		for (const rejected of [
			{ ...uri(source), scheme: 'https' },
			{ ...uri(source), authority: 'not-local' },
			uri(linked), uri(folder), uri(wrong), uri(large),
		]) {
			f.select([rejected]);
			await importPdf();
		}
		assert.equal(f.notices.length, 6);
		assert.deepEqual(f.state.imports, []);
		assert.equal(fs.existsSync(path.join(f.root, 'profile/pdf-imports')), false);
		assert.deepEqual([f.opened, f.external], [[], []]);
		assert.deepEqual(fs.readFileSync(source), pdfFixture);
	} finally { f.dispose(); }
});

test('failed registration rolls back just the new PDF file and leaves the originals and other copies', async () => {
	const f = await fixture({ beforeUpdate: async () => { throw new Error('storage unavailable'); } });
	try {
		const original = writePdfFixture(f);
		const folder = path.join(f.root, 'profile/pdf-imports');
		fs.mkdirSync(folder);
		const existing = path.join(folder, 'existing.pdf');
		fs.writeFileSync(existing, 'previous copy');

		f.select([uri(original)]);
		await f.actions.get('myself.documentation.importPdf')();
		assert.deepEqual(fs.readdirSync(folder), ['existing.pdf']);
		assert.equal(fs.readFileSync(existing, 'utf8'), 'previous copy');
		assert.deepEqual(fs.readFileSync(original), pdfFixture);
		assert.deepEqual(f.state.imports, []);
		assert.equal(f.notices.length, 1);
	} finally { f.dispose(); }
});

test('disposal during exclusive PDF copy creation rolls back before registration', async () => {
	const f = await fixture();
	const entered = deferred(), release = deferred();
	try {
		const original = writePdfFixture(f);
		f.select([uri(original)]);
		f.delay(file => { if (file.startsWith('/profile/pdf-imports/')) { entered.resolve(); return release.promise; } });
		const importing = f.actions.get('myself.documentation.importPdf')();
		await entered.promise;
		f.provider.dispose();
		release.resolve();
		await importing;
		assert.deepEqual(fs.readdirSync(path.join(f.root, 'profile/pdf-imports')), []);
		assert.deepEqual(f.state.imports, []);
		assert.deepEqual(f.notices, []);
		assert.deepEqual(fs.readFileSync(original), pdfFixture);
	} finally { release.resolve(); f.dispose(); }
});

test('PDF removal asks for explicit confirmation and affects only the imported copy', async () => {
	let confirmed = false;
	const f = await fixture({ confirmPdfRemoval: button => confirmed ? button : undefined });
	try {
		const original = writePdfFixture(f);
		f.select([uri(original)]);
		await f.actions.get('myself.documentation.importPdf')();
		const [entry] = f.state.imports;
		const copy = path.join(f.root, 'profile', entry.file);
		const remove = f.actions.get('myself.documentation.remove');
		await remove({ ...entry, id: 'not-registered' });
		assert.deepEqual(f.warnings, []);
		await remove(entry);
		assert.deepEqual(f.warnings, [{
			message: 'Remove the imported PDF copy?',
			settings: { modal: true, detail: 'The original file is kept.' },
			button: 'Remove PDF Copy',
		}]);
		assert.equal(fs.existsSync(copy), true);
		assert.deepEqual(f.state.imports, [entry]);

		confirmed = true;
		await remove({ ...entry, file: original });
		assert.equal(fs.existsSync(copy), false);
		assert.deepEqual(f.state.imports, []);
		assert.deepEqual(fs.readFileSync(original), pdfFixture);
	} finally { f.dispose(); }
});

test('a PDF copy replaced by a symlink is rejected for removal and its registration is restored', async () => {
	const f = await fixture({ confirmPdfRemoval: button => button });
	try {
		const original = writePdfFixture(f);
		f.select([uri(original)]);
		await f.actions.get('myself.documentation.importPdf')();
		const [entry] = f.state.imports;
		const copy = path.join(f.root, 'profile', entry.file);
		fs.unlinkSync(copy);
		fs.symlinkSync(original, copy);
		await f.actions.get('myself.documentation.remove')(entry);
		assert.equal(fs.lstatSync(copy).isSymbolicLink(), true);
		assert.deepEqual(fs.readFileSync(original), pdfFixture);
		assert.deepEqual(f.state.imports, [entry]);
		assert.deepEqual(f.notices, ['The imported PDF copy could not be removed.']);
	} finally { f.dispose(); }
});

test('the library restores only registered PDF entries with managed copy paths', async () => {
	const id = '09f83155-38a9-4e78-a20f-99cb8dd22f40';
	const entry = { id, format: 'pdf', group: 'imported', title: 'Document.pdf', file: `pdf-imports/${id}.pdf`, source: '', sha256: createHash('sha256').update(pdfFixture).digest('hex') };
	const f = await fixture({ imports: [
		entry,
		{ ...entry, sha256: undefined },
		{ ...entry, id: 'another', file: 'imports/abc.pdf' },
		{ ...entry, id: 'mismatch', file: entry.file },
		{ ...entry, id: 'remote', source: 'https://outside.invalid/original.pdf' },
	] });
	try {
		assert.deepEqual(f.provider.getChildren({ id: 'imported' }), [entry]);
		assert.deepEqual(f.opened, []);
	} finally { f.dispose(); }
});

test('a failed PDF removal registration update leaves the confirmed copy intact', async () => {
	let failUpdate = false;
	const f = await fixture({
		confirmPdfRemoval: button => button,
		beforeUpdate: async () => { if (failUpdate) { throw new Error('storage unavailable'); } },
	});
	try {
		const original = writePdfFixture(f);
		f.select([uri(original)]);
		await f.actions.get('myself.documentation.importPdf')();
		const [entry] = f.state.imports;
		failUpdate = true;
		await f.actions.get('myself.documentation.remove')(entry);
		assert.deepEqual(f.state.imports, [entry]);
		assert.deepEqual(fs.readFileSync(path.join(f.root, 'profile', entry.file)), pdfFixture);
		assert.deepEqual(fs.readFileSync(original), pdfFixture);
		assert.deepEqual(f.notices, ['The imported PDF copy could not be removed.']);
	} finally { f.dispose(); }
});

for (const timing of ['before', 'during']) {
	test(`normal Remove preserves a regular PDF replacement ${timing} confirmation`, async () => {
		const entered = deferred(), release = deferred();
		const f = await fixture({ confirmPdfRemoval: async button => {
			entered.resolve();
			if (timing === 'during') { await release.promise; }
			return button;
		} });
		try {
			const original = writePdfFixture(f);
			f.select([uri(original)]);
			await f.actions.get('myself.documentation.importPdf')();
			const [entry] = f.state.imports;
			const copy = path.join(f.root, 'profile', entry.file);
			const replacement = Buffer.from(pdfFixture);
			replacement[replacement.indexOf('fixture')] = 0x52;
			const replace = () => {
				fs.renameSync(copy, copy + '.saved');
				fs.writeFileSync(copy, replacement);
			};
			if (timing === 'before') { replace(); }
			const removing = f.actions.get('myself.documentation.remove')(entry);
			await entered.promise;
			if (timing === 'during') { replace(); }
			release.resolve();
			await removing;
			assert.equal(fs.existsSync(copy), true);
			assert.deepEqual(fs.readFileSync(copy), replacement);
			assert.deepEqual(fs.readFileSync(copy + '.saved'), pdfFixture);
			assert.deepEqual(fs.readFileSync(original), pdfFixture);
			assert.deepEqual(f.state.imports, [entry]);
			assert.deepEqual(f.notices, ['The imported PDF copy could not be removed.']);
		} finally { release.resolve(); f.dispose(); }
	});
}
