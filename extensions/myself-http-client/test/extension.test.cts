/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadWith } = require('./helpers.cts');
const { LocalHttpError } = require('../out/model.js');

function fixture() {
	const state = { methods: 0, inputs: 0, confirmations: [], requests: [], panels: [], info: [], errors: [] };
	const vscode = {
		workspace: { isTrusted: true, workspaceFolders: [] },
		env: { language: 'en', remoteName: undefined },
		ViewColumn: { Beside: -2 },
		ProgressLocation: { Notification: 15 },
		l10n: { t: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => String(args[Number(index)])) },
		commands: {
			registerCommand(id, handler) {
				assert.equal(id, 'myself.localHttp.request');
				state.command = handler;
				return { dispose() { state.command = undefined; } };
			},
		},
		window: {
			async showQuickPick(items) {
				state.methods++;
				assert.deepEqual(items, ['GET', 'POST']);
				return 'POST';
			},
			async showInputBox(options) {
				state.inputs++;
				const answer = state.inputs === 1 ? 'http://127.0.0.1:8080/service?mode=test' : 'ю';
				assert.equal(options.validateInput?.(answer), undefined);
				return answer;
			},
			async showWarningMessage(message, options, action) {
				state.confirmations.push({ message, options, action });
				if (state.onConfirm) {
					return state.onConfirm(action);
				}
				return action;
			},
			async withProgress(options, task) {
				assert.equal(options.cancellable, true);
				return task(undefined, {
					isCancellationRequested: false,
					onCancellationRequested(callback) {
						state.cancel = callback;
						return { dispose() { state.cancel = undefined; } };
					},
				});
			},
			createWebviewPanel(_type, _title, position, options) {
				let listener;
				const panel = {
					position, options, webview: {},
					onDidDispose(fn) { listener = fn; return { dispose() { listener = undefined; } }; },
					dispose() { listener?.(); },
				};
				state.panels.push(panel);
				return panel;
			},
			showInformationMessage(message) { state.info.push(message); },
			showErrorMessage(message) { state.errors.push(message); },
		},
	};
	const context = { subscriptions: [] };
	loadWith('extension.js', {
		vscode,
		'./transport': {
			async sendLocalRequest(method, url, body, signal) {
				state.requests.push({ method, url, body, signal });
				if (state.cancelOnDispatch) {
					state.cancel();
					assert.equal(signal.aborted, true);
					throw new LocalHttpError('cancelled');
				}
				return { status: 200, text: '<em>response</em>', truncated: false };
			},
		},
	}).activate(context);
	return { state, vscode, dispose() { for (const item of context.subscriptions) { item.dispose(); } } };
}

test('direct invocation in Restricted Mode or remote windows never opens prompts or requests', async () => {
	const app = fixture();
	app.vscode.workspace.isTrusted = false;
	await app.state.command('http://127.0.0.1/');
	app.vscode.workspace.isTrusted = true;
	app.vscode.env.remoteName = 'ssh-remote';
	await app.state.command();
	app.vscode.env.remoteName = undefined;
	app.vscode.workspace.workspaceFolders = [{ uri: { scheme: 'file', authority: 'remote' } }];
	await app.state.command();
	assert.deepEqual([app.state.methods, app.state.inputs, app.state.requests.length], [0, 0, 0]);
});

test('declining confirmation or losing trust after it prevents dispatch', async () => {
	const declined = fixture();
	declined.state.onConfirm = () => undefined;
	await declined.state.command();
	assert.equal(declined.state.requests.length, 0);
	const switched = fixture();
	switched.state.onConfirm = action => { switched.vscode.workspace.isTrusted = false; return action; };
	await switched.state.command();
	assert.equal(switched.state.requests.length, 0);
});

test('confirms the method and exact path, sends once, and displays an inert response', async () => {
	const app = fixture();
	await app.state.command('https://example.invalid/');
	assert.deepEqual(app.state.confirmations, [{
		message: 'Send one POST request to http://127.0.0.1:8080/service?',
		options: { modal: true, detail: 'The request includes 2 UTF-8 body bytes.\nThe query you entered will be included in this request.' },
		action: 'Send Once',
	}]);
	assert.equal(app.state.requests.length, 1);
	const [request] = app.state.requests;
	assert.deepEqual([request.method, request.url, request.body], ['POST', 'http://127.0.0.1:8080/service?mode=test', 'ю']);
	const [panel] = app.state.panels;
	assert.deepEqual(panel.options, { enableScripts: false, enableCommandUris: false, localResourceRoots: [] });
	assert.match(panel.webview.html, /<pre>&lt;em&gt;response&lt;\/em&gt;<\/pre>/);
	assert.equal(app.state.cancel, undefined);
	app.dispose();
});

test('progress cancellation aborts the dispatch and describes its server-side limit', async () => {
	const app = fixture();
	app.state.cancelOnDispatch = true;
	await app.state.command();
	assert.equal(app.state.requests.length, 1);
	assert.equal(app.state.panels.length, 0);
	assert.match(app.state.info[0], /server that already received it may still finish/);
	assert.equal(app.state.cancel, undefined);
});
