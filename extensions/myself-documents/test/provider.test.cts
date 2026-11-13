/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadWithVscode, emitter, uri, viewApi } = require('./helpers.cts');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture(options = {}) {
	const changes = emitter(), saves = emitter(), messages = emitter(), disposal = emitter();
	const sent = [], commands = new Map(), history = [], redo = [], executed = [];
	let provider, text = 'а)1\r\n\r\nб)3';
	const document = { uri: options.resource ?? uri('/Essay.txt'), version: 1, isDirty: false, eol: 2, getText: () => text, positionAt: offset => offset };
	const replace = value => { text = value; document.version++; document.isDirty = true; changes.fire({ document }); };
	const vscode = {
		...viewApi, EventEmitter: class { constructor() { this.event = emitter().event; } fire() {} dispose() {} }, EndOfLine: { CRLF: 2 }, Range: class { constructor(start, end) { this.start = start; this.end = end; } },
		WorkspaceEdit: class { replace(resource, range, value) { this.edit = { resource, range, value }; } },
		window: { createTreeView: () => ({ dispose() {} }), registerWebviewViewProvider: () => ({ dispose() {} }), showErrorMessage() {}, registerCustomEditorProvider: (_id, value) => { provider = value; return { dispose() {} }; } },
		workspace: {
			fs: { readFile: async () => new TextEncoder().encode('{"groups":[],"entries":[]}') },
			onDidChangeTextDocument: changes.event, onDidSaveTextDocument: saves.event,
			applyEdit: async edit => { const { range, value } = edit.edit; history.push(text); replace(text.slice(0, range.start) + value + text.slice(range.end)); return true; },
			save: async () => {
				const saved = 'saveResult' in options ? options.saveResult : document.uri;
				if (saved) { document.isDirty = false; saves.fire(document); }
				return saved;
			}
		},
		commands: {
			registerCommand: (id, action) => { commands.set(id, action); return { dispose() {} }; },
			getCommands: async () => [],
			executeCommand: async (id, ...args) => {
				executed.push([id, ...args]);
				if (id === 'undo') { redo.push(text); replace(history.pop()); }
				if (id === 'redo') { history.push(text); replace(redo.pop()); }
			}
		}
	};
	const extension = loadWithVscode('extension.js', vscode);
	extension.activate({ subscriptions: [], extensionUri: uri('extension'), globalState: { get: () => [] } });
	await provider.resolveCustomTextEditor(document, { webview: { cspSource: 'https://example.invalid', asWebviewUri: u => u, postMessage: m => sent.push(m), onDidReceiveMessage: messages.event }, onDidDispose: disposal.event });
	return { document, sent, executed, changes, saves, disposal, text: () => text, replace, message: async message => { messages.fire(message); await tick(); }, history };
}

test('provider edits the TextDocument, preserves CRLF, saves and follows host undo/redo', async () => {
	const f = await fixture();
	await f.message({ type: 'edit', id: 1, version: 1, text: 'а)1\n\nб)3\nEssay' });
	assert.equal(f.text(), 'а)1\r\n\r\nб)3\r\nEssay');
	await f.message({ type: 'action', action: 'undo', version: f.document.version });
	assert.equal(f.text(), 'а)1\r\n\r\nб)3');
	await f.message({ type: 'action', action: 'redo', version: f.document.version });
	await f.message({ type: 'action', action: 'save', version: f.document.version });
	assert.equal(f.document.isDirty, false);
	assert.equal(f.sent.findLast(m => m.type === 'snapshot').text, 'а)1\n\nб)3\nEssay');
	f.disposal.fire();
	assert.equal(f.changes.listeners.size + f.saves.listeners.size, 0);
});

test('stale edits cannot replace external changes', async () => {
	const f = await fixture();
	f.replace('external');
	await f.message({ type: 'edit', id: 2, version: 1, text: 'local draft' });
	assert.deepEqual({ text: f.text(), conflict: f.sent.at(-1).conflict, ack: f.sent.at(-1).ack, edits: f.history.length }, { text: 'external', conflict: true, ack: 2, edits: 0 });
	f.disposal.fire();
});

test('missing backend is a clear notice, not a successful export', async () => {
	const f = await fixture();
	await f.message({ type: 'action', action: 'export', version: 1, page: require('../out/document.js').defaultPage });
	assert.match(f.sent.find(m => m.type === 'notice').text, /not available/);
	assert.equal(f.text(), 'а)1\r\n\r\nб)3');
	f.disposal.fire();
});


test('Save As replaces the saved resource editor without adding another tab', async () => {
	const destination = uri('/Saved essay.txt');
	const f = await fixture({ resource: uri('untitled:Untitled-1'), saveResult: destination });
	f.replace('Новый документ');
	await f.message({ type: 'action', action: 'save', version: f.document.version });
	assert.deepEqual(f.executed, [['reopenActiveEditorWith', 'myself.documents.editor', destination]]);
	assert.equal(f.text(), 'Новый документ');
	assert.equal(f.sent.at(-1).type, 'actionDone');
	f.disposal.fire();
});

test('cancelled Save As keeps the dirty document without opening another editor', async () => {
	const f = await fixture({ resource: uri('untitled:Untitled-1'), saveResult: undefined });
	f.replace('Unsaved draft');
	await f.message({ type: 'action', action: 'save', version: f.document.version });
	assert.deepEqual(f.executed, []);
	assert.equal(f.text(), 'Unsaved draft');
	assert.equal(f.document.isDirty, true);
	assert.equal(f.sent.at(-1).type, 'actionDone');
	f.disposal.fire();
});

test('saving to the same URI does not recreate the document editor', async () => {
	const f = await fixture({ saveResult: uri('/Essay.txt') });
	await f.message({ type: 'action', action: 'save', version: f.document.version });
	assert.deepEqual(f.executed, []);
	assert.equal(f.document.isDirty, false);
	f.disposal.fire();
});
