/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadWithVscode, emitter, viewApi } = require('./helpers.cts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const uri = value => ({ path: value, scheme: 'file', authority: '', toString: () => value });
async function fixture(options = {}) {
	const actions = new Map(), files = new Map(), reads = [], writes = [], notices = [], external = [], sent = [];
	const events = emitter(), disposed = emitter(); const state = { imports: [] };
	let provider, panel, selection; let beforeRead = options.beforeRead;
	const catalog = { groups: [{ id: 'test', title: 'Test', version: '1', license: 'MIT' }], entries: [
		{ id: 'one', group: 'test', title: 'One', file: 'test/one.html', source: 'https://example.invalid/one.html', format: 'html' },
		{ id: 'two', group: 'test', title: 'Two', file: 'test/two.html', source: 'https://example.invalid/two.html', format: 'html' },
	] };
	files.set('/extension/documentation/catalog.json', Buffer.from(JSON.stringify(catalog)));
	files.set('/extension/documentation/test/one.html', Buffer.from('<h1>One</h1>'));
	files.set('/extension/documentation/test/two.html', Buffer.from('<h1>Two</h1>'));
	const vscode = {
		...viewApi, Uri: { joinPath: (base, ...parts) => uri(base.path + '/' + parts.join('/')), parse: value => ({ toString: () => value }) },
		EventEmitter: class { constructor() { const e = emitter(); this.event = e.event; this.fire = e.fire; } dispose() {} },
		TreeItem: class { constructor(label) { this.label = label; } }, TreeItemCollapsibleState: { None: 0, Collapsed: 1 }, ThemeIcon: class {}, ViewColumn: { Beside: 2 },
		env: { language: 'en', openExternal: async value => { external.push(value.toString()); return true; } },
		window: {
			createTreeView: (_id, options) => { provider = options.treeDataProvider; return { dispose() {} }; },
			createWebviewPanel: (_type, title, _column, options) => {
				panel = { title, options, reveal() {}, dispose: () => disposed.fire(), onDidDispose: disposed.event,
					webview: { cspSource: 'https://local.invalid', asWebviewUri: resource => resource.toString(), onDidReceiveMessage: events.event, postMessage: async message => { sent.push(message); return true; } } };
				return panel;
			},
			showOpenDialog: async () => selection,
			showErrorMessage: async text => { notices.push(text); },
			showInformationMessage: async (_text, action) => action,
		},
		commands: { registerCommand: (id, action) => { actions.set(id, action); return { dispose() {} }; } },
		workspace: { fs: {
			readFile: async resource => { reads.push(resource.path); if (beforeRead) { await beforeRead(resource.path); } if (!files.has(resource.path)) { throw new Error('missing'); } return files.get(resource.path); },
			stat: async resource => ({ size: files.get(resource.path)?.length ?? 0 }),
			createDirectory: async () => {}, writeFile: async (resource, bytes) => { writes.push(resource.path); files.set(resource.path, bytes); },
			delete: async resource => { files.delete(resource.path); },
		} },
	};
	const context = { subscriptions: [], extensionUri: uri('/extension'), globalStorageUri: uri('/profile'), globalState: { get: () => state.imports, update: async (_key, value) => { state.imports = value; } } };
	loadWithVscode('library.js', vscode).registerLibrary(context);
	if (!options.deferCatalog) { await provider.getChildren(); }
	return { actions, provider, files, reads, writes, notices, external, sent, state, panel: () => panel, select: value => { selection = value; }, delay: handler => { beforeRead = handler; },
		message: async value => { events.fire(value); await tick(); }, dispose: () => context.subscriptions.forEach(d => d.dispose()) };
}

test('reader opens beside code and sends only catalog content after the webview is ready', async () => {
	const f = await fixture();
	try {
		await f.actions.get('myself.documentation.open')('one');
		assert.equal(f.sent.length, 0);
		await f.message({ type: 'ready' });
		assert.equal(f.sent.at(-1).text, '<h1>One</h1>');
		assert.ok(!f.panel().webview.html.includes('<h1>One</h1>'));
		assert.deepEqual(f.panel().options.localResourceRoots.map(r => r.path), ['/extension/media', '/extension/out/webview']);
		await f.message({ type: 'link', href: 'two.html#section' });
		assert.deepEqual([f.sent.at(-1).title, f.sent.at(-1).fragment, f.external.length], ['Two', 'section', 0]);
		await f.message({ type: 'back' }); assert.equal(f.sent.at(-1).title, 'One');
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
		f.delay(file => file.endsWith('one.html') ? gate : undefined);
		const first = f.actions.get('myself.documentation.open')('one'); await tick();
		await f.actions.get('myself.documentation.open')('two'); await f.message({ type: 'ready' });
		release(); await first;
		assert.equal(f.sent.at(-1).title, 'Two');
	} finally { release?.(); f.dispose(); }
});


test('closing the reader cancels a pending navigation without reopening it', async () => {
	const f = await fixture(); let release;
	try {
		await f.actions.get('myself.documentation.open')('one');
		const originalPanel = f.panel();
		const gate = new Promise(resolve => { release = resolve; });
		f.delay(file => file.endsWith('two.html') ? gate : undefined);
		const pending = f.actions.get('myself.documentation.open')('two'); await tick();
		originalPanel.dispose(); release(); await pending;
		assert.equal(f.panel(), originalPanel, 'completed navigation must not create another panel');
		assert.deepEqual(f.notices, []);
		await f.actions.get('myself.documentation.open')('two');
		assert.notEqual(f.panel(), originalPanel, 'a later explicit open still works');
	} finally { release?.(); f.dispose(); }
});

test('disposal while the catalog loads prevents pending commands from opening a reader', async () => {
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	const f = await fixture({ deferCatalog: true, beforeRead: file => file.endsWith('catalog.json') ? gate : undefined });
	try {
		const pending = f.actions.get('myself.documentation.open')('one');
		f.dispose(); release(); await pending;
		assert.equal(f.panel(), undefined);
		assert.deepEqual(f.reads, ['/extension/documentation/catalog.json']);
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});

test('a failed read completed after closing the reader does not show a stale error', async () => {
	const f = await fixture(); let release;
	try {
		await f.actions.get('myself.documentation.open')('one');
		const gate = new Promise(resolve => { release = resolve; });
		f.delay(file => file.endsWith('two.html') ? gate : undefined);
		const pending = f.actions.get('myself.documentation.open')('two'); await tick();
		f.panel().dispose(); f.files.delete('/extension/documentation/test/two.html'); release(); await pending;
		assert.deepEqual(f.notices, []);
	} finally { release?.(); f.dispose(); }
});
