/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const { runWritingAction, writingCommands }: typeof import('../src/writingWorkflow.js') = require('../out/writingWorkflow.js');

type WritingWindow = Parameters<typeof runWritingAction>[1];
type Registration = NonNullable<ReturnType<WritingWindow['getExtension']>>;

const harperId = 'elijah-potter.harper';
const analyzerId = 'iglou-eu.text-analyzer';
const analyzer = {
	id: analyzerId,
	extensionUri: { scheme: 'file', authority: '' },
	packageJSON: { contributes: { commands: [{ command: 'textAnalyzer.openPanel' }] } },
};

function fixture(language?: string) {
	const registrations = new Map<string, Registration>();
	const lookups: string[] = [];
	const calls: string[][] = [];
	let failure = false;
	const window: WritingWindow = {
		activeLanguage: () => language,
		getExtension(id) {
			lookups.push(id);
			return registrations.get(id);
		},
		async executeCommand(...args: string[]) {
			calls.push(args);
			if (failure) {
				throw new Error('private backend detail');
			}
		},
	};
	return {
		window, registrations, lookups, calls,
		setLanguage(value: string) { language = value; },
		setFailure() { failure = true; },
	};
}

test('the manifest exposes all workflow actions in both visible menus for the two text languages', () => {
	const manifest = require('../package.json');
	const submenuId = 'myself.englishWriting';
	const ids = Object.values(writingCommands);
	assert.deepEqual(manifest.contributes.commands.map(({ command }: { command: string }) => command), ids);
	assert.deepEqual(manifest.contributes.menus[submenuId].map(({ command }: { command: string }) => command), ids);
	assert.deepEqual(manifest.contributes.submenus.map(({ id }: { id: string }) => id), [submenuId]);
	for (const menu of ['editor/title', 'editor/context']) {
		const [entry] = manifest.contributes.menus[menu];
		assert.deepEqual({ submenu: entry.submenu, when: entry.when }, { submenu: submenuId, when: 'editorLangId =~ /^(markdown|plaintext)$/' });
	}
	assert.deepEqual({
		activationEvents: manifest.activationEvents ?? [],
		extensionDependencies: manifest.extensionDependencies ?? [],
		extensionPack: manifest.extensionPack ?? [],
		dependencies: manifest.dependencies ?? {},
	}, { activationEvents: [], extensionDependencies: [], extensionPack: [], dependencies: {} });
});

test('direct invocation does not resolve extensions or dispatch outside the two supported languages', async () => {
	for (const language of [undefined, 'typescript', 'markdown-cell']) {
		const state = fixture(language);
		for (const action of Object.keys(writingCommands) as (keyof typeof writingCommands)[]) {
			assert.deepEqual(await runWritingAction(action, state.window), { kind: 'unsupported-editor' });
		}
		assert.deepEqual({ calls: state.calls, lookups: state.lookups }, { calls: [], lookups: [] });
	}
});

test('Problems and Code Actions delegate to the native commands without a provider or edit arguments', async () => {
	for (const language of ['markdown', 'plaintext']) {
		const state = fixture(language);
		assert.deepEqual(await runWritingAction('problems', state.window), { kind: 'dispatched' });
		assert.deepEqual(await runWritingAction('codeActions', state.window), { kind: 'dispatched' });
		assert.deepEqual({ calls: state.calls, lookups: state.lookups }, {
			calls: [['workbench.actions.view.problems'], ['editor.action.quickFix']],
			lookups: [],
		});
	}
});

test('Text Analyzer dispatches exactly the verified contribution, without a document argument', async () => {
	const state = fixture('markdown');
	state.registrations.set(analyzerId, { ...analyzer, id: 'Iglou-EU.Text-Analyzer' });
	assert.deepEqual(await runWritingAction('analyzeText', state.window), { kind: 'dispatched' });
	assert.deepEqual({ calls: state.calls, lookups: state.lookups }, { calls: [['textAnalyzer.openPanel']], lookups: [analyzerId] });
});

test('Text Analyzer rejects an absent or remote extension, an unexpected owner, or a missing command declaration', async () => {
	const variants = [
		undefined,
		{ ...analyzer, id: 'unrelated.analyzer' },
		{ ...analyzer, extensionUri: { scheme: 'vscode-remote', authority: 'ssh-remote+test' } },
		{ ...analyzer, extensionUri: { scheme: 'file', authority: 'files.example' } },
		{ ...analyzer, packageJSON: { contributes: { commands: [{ command: 'textAnalyzer.clearHighlight' }] } } },
		{ ...analyzer, packageJSON: { contributes: { commands: [{ command: 'textAnalyzer.OpenPanel' }] } } },
		{ ...analyzer, packageJSON: { contributes: { commands: { command: 'textAnalyzer.openPanel' } } } },
		{ ...analyzer, packageJSON: { contributes: { commands: [null] } } },
	];
	for (const extension of variants) {
		const state = fixture('plaintext');
		if (extension) {
			state.registrations.set(analyzerId, extension);
		}
		assert.deepEqual(await runWritingAction('analyzeText', state.window), { kind: 'missing-analyzer' });
		assert.deepEqual(state.calls, []);
	}
});

test('tool availability reads registrations only, including when Harper has no active diagnostics', async () => {
	const state = fixture('markdown');
	assert.deepEqual(await runWritingAction('tools', state.window), { kind: 'tools', harper: false, analyzer: false });
	const harperRegistration = {
		id: harperId,
		extensionUri: { scheme: 'file', authority: '' },
		packageJSON: {},
		isActive: false,
		activate() { assert.fail('Availability must not activate Harper'); },
	};
	state.registrations.set(harperId, harperRegistration);
	state.registrations.set(analyzerId, analyzer);
	assert.deepEqual(await runWritingAction('tools', state.window), { kind: 'tools', harper: true, analyzer: true });
	assert.deepEqual({ calls: state.calls, lookups: state.lookups }, { calls: [], lookups: [harperId, analyzerId, harperId, analyzerId] });
});

test('native and optional command failures return a bounded result without retries', async () => {
	const state = fixture('plaintext');
	state.registrations.set(analyzerId, analyzer);
	state.setFailure();
	assert.deepEqual(await runWritingAction('problems', state.window), { kind: 'command-failed', action: 'problems' });
	assert.deepEqual(await runWritingAction('codeActions', state.window), { kind: 'command-failed', action: 'codeActions' });
	assert.deepEqual(await runWritingAction('analyzeText', state.window), { kind: 'command-failed', action: 'analyzeText' });
	assert.deepEqual(state.calls, [['workbench.actions.view.problems'], ['editor.action.quickFix'], ['textAnalyzer.openPanel']]);
});

test('the active editor language is checked again on the next invocation', async () => {
	const state = fixture('markdown');
	assert.deepEqual(await runWritingAction('codeActions', state.window), { kind: 'dispatched' });
	state.setLanguage('javascript');
	assert.deepEqual(await runWritingAction('codeActions', state.window), { kind: 'unsupported-editor' });
	assert.deepEqual(state.calls, [['editor.action.quickFix']]);
});
