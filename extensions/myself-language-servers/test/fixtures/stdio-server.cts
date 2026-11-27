/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');

async function* readMessages(input) {
	let pending = Buffer.alloc(0);
	for await (const chunk of input) {
		pending = Buffer.concat([pending, chunk]);
		for (let separator; (separator = pending.indexOf('\r\n\r\n')) !== -1;) {
			const match = /^Content-Length: (\d+)(?:\r\nContent-Type: [^\r\n]+)?$/i.exec(pending.toString('ascii', 0, separator));
			assert.ok(match, 'expected an LSP Content-Length header');
			const start = separator + 4;
			const end = start + Number(match[1]);
			if (pending.length < end) {
				break;
			}
			const message = JSON.parse(pending.toString('utf8', start, end));
			pending = pending.subarray(end);
			assert.equal(message.jsonrpc, '2.0');
			yield message;
		}
	}
	assert.equal(pending.length, 0, 'stdin ended inside an LSP frame');
}

function send(message) {
	const body = JSON.stringify({ jsonrpc: '2.0', ...message });
	process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

async function serve() {
	const messages = readMessages(process.stdin);
	async function receive(method, request = false) {
		const { value: message } = await messages.next();
		assert.equal(message?.method, method);
		assert.equal(Object.hasOwn(message, 'id'), request);
		return message;
	}

	const initialize = await receive('initialize', true);
	assert.equal(typeof initialize.params.processId, 'number');
	assert.equal(initialize.params.capabilities.textDocument.publishDiagnostics.versionSupport, true);
	send({
		id: initialize.id,
		result: {
			serverInfo: { name: 'nerded-lsp-stdio-fixture' },
			capabilities: { textDocumentSync: { openClose: true, change: 0 }, completionProvider: {} },
		},
	});
	await receive('initialized');

	const { params: { textDocument } } = await receive('textDocument/didOpen');
	assert.equal(textDocument.languageId, 'nerded-lsp-fixture');
	assert.equal(textDocument.text, 'let café =\n');
	const position = { line: 0, character: textDocument.text.trimEnd().length };
	send({
		method: 'textDocument/publishDiagnostics',
		params: {
			uri: textDocument.uri,
			version: textDocument.version,
			diagnostics: [{
				range: { start: { line: 0, character: position.character - 1 }, end: position },
				severity: 1,
				message: 'Expected a value for café',
			}],
		},
	});

	const completion = await receive('textDocument/completion', true);
	assert.deepEqual(completion.params, { textDocument: { uri: textDocument.uri }, position });
	send({ id: completion.id, result: [{ label: 'valeur_café', kind: 6 }] });

	const shutdown = await receive('shutdown', true);
	send({ id: shutdown.id, result: null });
	await receive('exit');
	await messages.return();
	process.exitCode = 0;
}

process.exitCode = 1;
serve().catch(error => {
	console.error(error);
	process.stdin.destroy();
});
