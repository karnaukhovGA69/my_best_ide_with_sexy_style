/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');

// Reuse the protocol dependency of the built-in CSS extension's language client.
const requireFromCss = createRequire(join(__dirname, '../../css-language-features/package.json'));
const requireFromClient = createRequire(requireFromCss.resolve('vscode-languageclient/node'));
const {
	CompletionRequest, createProtocolConnection, DidOpenTextDocumentNotification, ExitNotification,
	InitializedNotification, InitializeRequest, PublishDiagnosticsNotification, ShutdownRequest,
	StreamMessageReader, StreamMessageWriter,
} = requireFromClient('vscode-languageserver-protocol/node');

const fixtureSha256 = '84df2e35ab5bd6740435dd996732080f92fd18a360c7f9ac000d962df970b61a';

test('synthetic stdio server initializes, publishes diagnostics, completes and exits', { timeout: 10000 }, async t => {
	const source = await fs.readFile(join(__dirname, 'fixtures', 'stdio-server.cts'));
	assert.equal(createHash('sha256').update(source).digest('hex'), fixtureSha256, 'review fixture changes before updating the pinned digest');
	const root = await fs.mkdtemp(join(tmpdir(), 'nerded-lsp-stdio-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const script = join(root, 'stdio-server.cts');
	await fs.writeFile(script, source, { flag: 'wx', mode: 0o600 });

	const child = spawn(process.execPath, [script], {
		cwd: root, env: { HOME: root, ELECTRON_RUN_AS_NODE: '1' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
	});
	const closed = new Promise(resolve => child.once('close', (code, signal) => resolve([code, signal])));
	let stderr = '';
	child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
	const connection = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
	const diagnostics = new Promise(resolve => connection.onNotification(PublishDiagnosticsNotification.type, resolve));
	let exiting = false;
	let timer;
	const failed = new Promise((_, reject) => {
		child.once('error', reject);
		connection.onError(([error]) => reject(error));
		connection.onClose(() => {
			if (!exiting) {
				reject(new Error('stdio closed before the LSP exit notification'));
			}
		});
		timer = setTimeout(() => reject(new Error('Synthetic LSP exchange timed out')), 5000);
	});
	connection.listen();

	try {
		await Promise.race([failed, (async () => {
			const initialized = await connection.sendRequest(InitializeRequest.type, {
				processId: process.pid,
				rootUri: pathToFileURL(root).href,
				capabilities: { textDocument: { publishDiagnostics: { versionSupport: true } } },
			});
			assert.deepEqual(initialized, {
				serverInfo: { name: 'nerded-lsp-stdio-fixture' },
				capabilities: { textDocumentSync: { openClose: true, change: 0 }, completionProvider: {} },
			});
			await connection.sendNotification(InitializedNotification.type, {});
			const uri = pathToFileURL(join(root, 'café.fixture')).href;
			await connection.sendNotification(DidOpenTextDocumentNotification.type, {
				textDocument: { uri, languageId: 'nerded-lsp-fixture', version: 1, text: 'let café =\n' },
			});
			assert.deepEqual(await diagnostics, {
				uri, version: 1,
				diagnostics: [{
					range: { start: { line: 0, character: 9 }, end: { line: 0, character: 10 } },
					severity: 1,
					message: 'Expected a value for café',
				}],
			});
			assert.deepEqual(await connection.sendRequest(CompletionRequest.type, {
				textDocument: { uri }, position: { line: 0, character: 10 },
			}), [{ label: 'valeur_café', kind: 6 }]);

			assert.equal(await connection.sendRequest(ShutdownRequest.type), null);
			exiting = true;
			await connection.sendNotification(ExitNotification.type);
			assert.deepEqual(await closed, [0, null], stderr);
		})()]);
	} finally {
		clearTimeout(timer);
		connection.dispose();
		if (child.exitCode === null && child.signalCode === null && child.pid !== undefined) {
			child.kill('SIGKILL');
		}
		await closed;
		if (stderr) {
			t.diagnostic(stderr);
		}
	}
});
