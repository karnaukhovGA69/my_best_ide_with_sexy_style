/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const { ChildProcess }: typeof import('node:child_process') = require('node:child_process');
const { readFileSync }: typeof import('node:fs') = require('node:fs');
const { createRequire }: typeof import('node:module') = require('node:module');
const { join }: typeof import('node:path') = require('node:path');
const { PassThrough }: typeof import('node:stream') = require('node:stream');
const { runInNewContext }: typeof import('node:vm') = require('node:vm');
const { maxStderr, maxStdout, runSchema }: typeof import('../src/psql.js') = require('../out/psql.js');
const { parseSchemaOutput, renderSchema, schemaSql, maxSchemaRows }: typeof import('../src/schema.js') = require('../out/schema.js');
const { isLocalTarget, SchemaError }: typeof import('../src/target.js') = require('../out/target.js');
const { inspectConfirmedSchema }: typeof import('../src/workflow.js') = require('../out/workflow.js');

type SpawnOptions = import('node:child_process').SpawnOptions;
type LocalTarget = import('../src/target.js').LocalTarget;

const target: LocalTarget = {
	executable: '/fixtures/Postgres Tools/psql',
	socketDirectory: '/fixtures/pg socket',
	database: 'fixture',
	role: 'reader',
	port: 5439,
};
const data = JSON.stringify([['public', 'items', 'id', 'integer']]);
const expected = { rows: [['public', 'items', 'id', 'integer']], truncated: false } as const;
const hasCode = (code: string) => (error: Error) => error instanceof SchemaError && error.code === code;

class SyntheticProcess extends ChildProcess {
	override stdout = new PassThrough();
	override stderr = new PassThrough();
	readonly signals: (NodeJS.Signals | number | undefined)[] = [];

	override kill(signal?: NodeJS.Signals | number): boolean {
		this.signals.push(signal);
		return true;
	}
}

test('requires visible trusted local editor actions without dependency or startup activation', () => {
	const manifest = require('../package.json');
	for (const menu of ['editor/title', 'editor/context']) {
		const [entry] = manifest.contributes.menus[menu];
		assert.equal(entry.command, 'myself.postgresqlSchema.open');
		assert.equal(entry.when, `editorLangId == sql && resourceScheme == file && isWorkspaceTrusted && remoteName == '' && (isMac || isLinux)`);
	}
	assert.equal(manifest.capabilities.untrustedWorkspaces.supported, false);
	assert.equal(manifest.capabilities.virtualWorkspaces, false);
	assert.deepEqual([manifest.activationEvents ?? [], manifest.extensionDependencies ?? [], manifest.dependencies ?? {}], [[], [], {}]);
});

test('the command checks workspace and editor context before opening the picker, including direct invocations', async () => {
	const uri = { scheme: 'file', authority: '', query: '', fragment: '', path: '/fixture/query.sql' };
	const document = { uri, languageId: 'sql' };
	const events: string[] = [];
	const disposable = { dispose() { } };
	let command: ((...args: unknown[]) => Promise<void>) | undefined;
	const api = {
		env: { remoteName: undefined as string | undefined },
		workspace: {
			isTrusted: true,
			getWorkspaceFolder: () => ({ uri: { ...uri, path: '/fixture' } }),
			onDidChangeWorkspaceFolders: () => disposable,
		},
		window: {
			activeTextEditor: { document },
			onDidChangeActiveTextEditor: () => disposable,
			async showInformationMessage() { events.push('refused'); },
			async showOpenDialog() { events.push('picker'); return undefined; },
		},
		commands: {
			registerCommand(id: string, handler: typeof command) {
				assert.equal(id, 'myself.postgresqlSchema.open');
				command = handler;
				return disposable;
			}
		},
		l10n: { t: (text: string) => text },
	};
	const file = join(__dirname, '../out/extension.js');
	const load = createRequire(file);
	const extension: { activate?: (context: { subscriptions: { dispose(): void }[] }) => void } = {};
	runInNewContext(readFileSync(file, 'utf8'), {
		exports: extension, AbortController, process: { platform: 'darwin' },
		require: (specifier: string) => specifier === 'vscode' ? api : load(specifier),
	});
	assert.ok(extension.activate);
	extension.activate({ subscriptions: [] });
	assert.ok(command);
	api.workspace.isTrusted = false;
	await command(target);
	api.workspace.isTrusted = true;
	api.env.remoteName = 'ssh-remote';
	await command(target);
	api.env.remoteName = undefined;
	uri.authority = 'unexpected';
	await command(target);
	uri.authority = '';
	document.languageId = 'plaintext';
	await command(target);
	document.languageId = 'sql';
	await command(target);
	assert.deepEqual(events, ['refused', 'refused', 'refused', 'refused', 'picker']);
});

test('rejects nonlocal targets, host lists, connection strings, path traversal and nonliteral identifiers', async () => {
	const invalid: Partial<LocalTarget>[] = [
		{ executable: 'psql' }, { executable: '//server/share/psql' }, { executable: '/root/../psql' },
		{ socketDirectory: 'localhost' }, { socketDirectory: '@abstract' }, { socketDirectory: '/run/local,example.invalid' },
		{ socketDirectory: '/tmp/\0private' }, { socketDirectory: '/tmp/\nprivate' },
		{ database: 'postgres://elsewhere/db' }, { database: 'service=profile' }, { database: 'x'.repeat(64) },
		{ role: '--user' }, { role: 'a b' }, { port: 0 }, { port: 65536 }, { port: 3.5 },
	];
	for (const overrides of invalid) {
		const invalidTarget = { ...target, ...overrides };
		assert.equal(isLocalTarget(invalidTarget), false);
		let launched = false;
		await assert.rejects(runSchema(invalidTarget, new AbortController().signal, () => {
			launched = true;
			return new SyntheticProcess();
		}), hasCode('target'));
		assert.equal(launched, false);
	}
});

test('spawns precisely the approved argv and positive environment with one fixed query', async () => {
	const child = new SyntheticProcess();
	let invocation: { file: string; args: string[]; options: SpawnOptions } | undefined;
	const result = runSchema(target, new AbortController().signal, (file, args, options) => {
		invocation = { file, args, options };
		return child;
	});
	assert.deepEqual(invocation, {
		file: target.executable,
		args: [
			'-X', '-w', '--quiet', '--no-align', '--tuples-only', '--pset=pager=off', '--set=ON_ERROR_STOP=1',
			'--host=/fixtures/pg socket', '--port=5439', '--username=reader',
			'--dbname=dbname=fixture require_auth=none passfile=/dev/null connect_timeout=3', '--command', schemaSql,
		],
		options: { cwd: '/', shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { LC_ALL: 'C', LANG: 'C', PGCLIENTENCODING: 'UTF8' } },
	});
	assert.match(schemaSql, /BEGIN READ ONLY;[\s\S]*FROM information_schema\.columns[\s\S]*ROLLBACK;$/);
	assert.doesNotMatch(schemaSql, /\\|fixtures|COPY/);
	child.stdout.write(data.slice(0, 9));
	child.stdout.write(data.slice(9));
	child.emit('close', 0);
	assert.deepEqual(await result, expected);
});

test('classifies authentication and old-client errors without exposing stderr or retrying', async () => {
	for (const [stderr, code] of [
		['fe_sendauth: server requested SCRAM-SHA-256 authentication, but require_auth=none', 'credentials'],
		['invalid connection option "require_auth"', 'client-version'],
		['private backend detail', 'connection'],
	]) {
		const child = new SyntheticProcess();
		const result = runSchema(target, new AbortController().signal, () => child);
		child.stderr.write(stderr);
		child.emit('close', 2);
		await assert.rejects(result, (error: Error) => hasCode(code)(error) && error.message === code);
		assert.deepEqual(child.signals, []);
	}
});

test('cancellation before launch starts nothing and in-flight cancellation kills the child', async () => {
	const first = new AbortController();
	first.abort();
	let started = false;
	assert.equal(await runSchema(target, first.signal, () => {
		started = true;
		return new SyntheticProcess();
	}), undefined);
	assert.equal(started, false);
	const request = new AbortController();
	const child = new SyntheticProcess();
	const running = runSchema(target, request.signal, () => child);
	request.abort();
	assert.equal(await running, undefined);
	assert.deepEqual(child.signals, ['SIGKILL']);
	assert.equal(child.stdout.destroyed && child.stderr.destroyed, true);
});

test('a timeout and independent stdout and stderr caps terminate the child and reject the snapshot', async () => {
	const timedOut = new SyntheticProcess();
	await assert.rejects(runSchema(target, new AbortController().signal, () => timedOut, 5), hasCode('timeout'));
	assert.deepEqual(timedOut.signals, ['SIGKILL']);
	for (const [stream, max] of [['stdout', maxStdout], ['stderr', maxStderr]] as const) {
		const child = new SyntheticProcess();
		const result = runSchema(target, new AbortController().signal, () => child);
		child[stream].write(Buffer.alloc(max));
		assert.deepEqual(child.signals, []);
		child[stream].write(Buffer.from('x'));
		await assert.rejects(result, hasCode('output-limit'));
		assert.deepEqual(child.signals, ['SIGKILL']);
	}
});

test('handles launch failures and invalid results without exposing raw data', async () => {
	await assert.rejects(runSchema(target, new AbortController().signal, () => { throw new Error('private'); }), hasCode('launch'));
	const child = new SyntheticProcess();
	const result = runSchema(target, new AbortController().signal, () => child);
	child.emit('error', new Error('private'));
	await assert.rejects(result, hasCode('launch'));
	const invalid = new SyntheticProcess();
	const badOutput = runSchema(target, new AbortController().signal, () => invalid);
	invalid.stdout.write('private');
	invalid.emit('close', 0);
	await assert.rejects(badOutput, hasCode('invalid-result'));
});

test('requires confirmation, unchanged target identity and current trust before spawning', async () => {
	for (const change of ['decline', 'trust', 'identity', 'none']) {
		let allowed = true;
		let reads = 0;
		const events: string[] = [];
		const run = inspectConfirmedSchema(target, new AbortController().signal, {
			isCurrent: () => allowed,
			async confirm(selected) {
				assert.deepEqual(selected, target);
				events.push('confirm');
				if (change === 'trust') {
					allowed = false;
				}
				return change !== 'decline';
			},
		}, async selected => {
			events.push('inspect');
			reads++;
			return { target: selected, identity: change === 'identity' && reads === 2 ? 'replaced' : 'original' };
		}, async () => {
			events.push('execute');
			return expected;
		});
		if (change === 'identity') {
			await assert.rejects(run, hasCode('target-changed'));
			assert.deepEqual(events, ['inspect', 'confirm', 'inspect']);
		} else if (change === 'none') {
			assert.deepEqual(await run, expected);
			assert.deepEqual(events, ['inspect', 'confirm', 'inspect', 'execute']);
		} else {
			assert.equal(await run, undefined);
			assert.deepEqual(events, ['inspect', 'confirm']);
		}
	}
});

test('drops results received after a workspace or trust change', async () => {
	let allowed = true;
	const result = await inspectConfirmedSchema(target, new AbortController().signal, {
		isCurrent: () => allowed,
		confirm: async () => true,
	}, async selected => ({ target: selected, identity: 'original' }), async () => {
		allowed = false;
		return expected;
	});
	assert.equal(result, undefined);
});

test('parses only bounded metadata rows and escapes markup and bidi controls under a static CSP', () => {
	const row = ['public', '<img src=x>&', '"\u202econtrol"', 'integer'];
	const many = parseSchemaOutput(JSON.stringify(Array.from({ length: maxSchemaRows + 1 }, () => row)));
	assert.equal(many.rows.length, maxSchemaRows);
	assert.equal(many.truncated, true);
	assert.throws(() => parseSchemaOutput(JSON.stringify([['public', false, 'id', 'integer']])), hasCode('invalid-result'));
	assert.throws(() => parseSchemaOutput(JSON.stringify(Array.from({ length: maxSchemaRows + 2 }, () => row))), hasCode('invalid-result'));
	const html = renderSchema({ rows: many.rows.slice(0, 1), truncated: true }, {
		title: 'Schema', database: 'Fixture', headings: ['Schema', 'Table', 'Column', 'Type'], empty: 'Empty', truncated: 'Limited',
	});
	assert.match(html, /default-src 'none'; base-uri 'none'; form-action 'none'/);
	assert.match(html, /&lt;img src=x&gt;&amp;/);
	assert.match(html, /&quot; control&quot;/);
	assert.match(html, /Limited/);
	assert.doesNotMatch(html, /<img|<script|<a |\u202e/u);
});
