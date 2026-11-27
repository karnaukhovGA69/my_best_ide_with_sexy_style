/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire, wrap } = require('node:module');
const { runInThisContext } = require('node:vm');
const { test } = require('node:test');
const { maxInputBytes } = require('../out/model.js');

function fixture() {
	const state = { reads: 0, panels: [], errors: [], info: [], command: undefined };
	const vscode = {
		l10n: { t: (text, value) => value === undefined ? text : text.replace('{0}', value) },
		env: { language: 'en' },
		Position: class {
			constructor(line, character) {
				this.line = line;
				this.character = character;
			}
		},
		ViewColumn: { Beside: -2 },
		commands: {
			registerCommand(id, command) {
				assert.equal(id, 'myself.dataPreview.open');
				state.command = command;
				return { dispose() { state.command = undefined; } };
			},
		},
		window: {
			activeTextEditor: undefined,
			showErrorMessage(message) { state.errors.push(message); },
			showInformationMessage(message) { state.info.push(message); },
			createWebviewPanel(viewType, title, position, options) {
				let listener;
				const instance = {
					viewType, title, position, options, webview: {},
					viewColumn: 2, reveals: [], closed: false,
					reveal(...args) { instance.reveals.push(args); },
					onDidDispose(fn) {
						listener = fn;
						return { dispose() { listener = undefined; } };
					},
					dispose() {
						instance.closed = true;
						listener?.();
					},
				};
				state.panels.push(instance);
				return instance;
			},
		},
	};
	const file = require.resolve('../out/extension.js');
	const load = createRequire(file);
	const registered = { exports: {} };
	runInThisContext(wrap(readFileSync(file, 'utf8')), { filename: file })(registered.exports,
		name => name === 'vscode' ? vscode : load(name), registered);
	const context = { subscriptions: [] };
	registered.exports.activate(context);
	return {
		state,
		open(text, { scheme = 'file', authority = '', path = '/fixtures/sample.json', length = text.length } = {}) {
			vscode.window.activeTextEditor = {
				document: {
					uri: { scheme, authority, path },
					lineCount: 1,
					offsetAt(position) {
						assert.deepEqual([position.line, position.character], [1, 0]);
						return length;
					},
					getText() { state.reads++; return text; },
				},
			};
			state.command({ scheme: 'https', path: '/ignored.csv' });
		},
		dispose() {
			for (const item of context.subscriptions) {
				item.dispose();
			}
		},
	};
}

test('uses the active buffer for an inert side-by-side panel, refreshes it and disposes it', () => {
	const app = fixture();
	app.open('{"unsaved":"yes"}');
	const [panel] = app.state.panels;
	assert.deepEqual(panel.position, { viewColumn: -2, preserveFocus: true });
	assert.deepEqual(panel.options, { enableScripts: false, enableCommandUris: false, localResourceRoots: [] });
	assert.match(panel.webview.html, /&quot;unsaved&quot;/);
	app.open('row,value', { path: '/fixtures/other.csv' });
	assert.equal(app.state.panels.length, 1);
	assert.match(panel.webview.html, /<td>row<\/td><td>value<\/td>/);
	assert.deepEqual(panel.reveals, [[2, true]]);
	app.dispose();
	assert.equal(panel.closed, true);
	assert.equal(app.state.command, undefined);
});

test('does not read unsupported and oversized buffers before reporting the reason', () => {
	const app = fixture();
	app.open('x', { scheme: 'vscode-remote' });
	app.open('y', { path: '/fixtures/text.txt' });
	app.open('[]', { length: maxInputBytes + 1 });
	assert.deepEqual({ reads: app.state.reads, panels: app.state.panels.length, errors: app.state.errors.length, info: app.state.info.length },
		{ reads: 0, panels: 0, errors: 1, info: 2 });
});
