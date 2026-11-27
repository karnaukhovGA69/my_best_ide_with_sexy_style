/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { evaluateProjectReadiness, type ProjectReadinessSnapshot } from '../../common/projectReadiness.js';

/** Evaluate a single local root and narrow the result for assertions on its assessment. */
function evaluateLocal(folder: ProjectReadinessSnapshot['folders'][number]) {
	const [assessment] = evaluateProjectReadiness({ isTrusted: true, folders: [folder] }).folders;
	assert.strictEqual(assessment.kind, 'local');
	return assessment;
}

suite('Project readiness', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const folder = URI.file('/workspace/sample');

	test('reports both C build markers without choosing a build system or assuming a compilation database', () => {
		const result = evaluateLocal({ folder, markers: { 'CMakeLists.txt': 'file', Makefile: 'file', 'compile_commands.json': 'absent' } });
		assert.deepStrictEqual({ c: result.c, review: result.review }, {
			c: { buildMarkers: { 'CMakeLists.txt': 'present', Makefile: 'present' }, compilationDatabase: 'absent' },
			review: ['c-build-configuration'],
		});
	});

	test('reports a compilation database independently of build markers', () => {
		const result = evaluateLocal({ folder, markers: { 'compile_commands.json': 'file' } });
		assert.deepStrictEqual({ c: result.c, review: result.review }, {
			c: { buildMarkers: { 'CMakeLists.txt': 'unknown', Makefile: 'unknown' }, compilationDatabase: 'present' },
			review: ['c-compilation-database'],
		});
	});

	test('reports Python metadata and an environment directory without inferring interpreter selection', () => {
		const result = evaluateLocal({
			folder,
			markers: { 'pyproject.toml': 'file', 'requirements.txt': 'file', '.venv': 'directory' },
			pythonInterpreter: { kind: 'unset' },
		});
		assert.deepStrictEqual({ python: result.python, review: result.review }, {
			python: {
				markers: { 'pyproject.toml': 'present', 'requirements.txt': 'present', '.venv': 'present' },
				interpreter: { kind: 'unset' },
			},
			review: ['python-interpreter'],
		});
	});

	test('keeps a missing folder-relative interpreter visible even when .venv exists', () => {
		const result = evaluateLocal({
			folder,
			markers: { '.venv': 'directory' },
			pythonInterpreter: { kind: 'folder-relative', source: 'workspace-folder', baseFolder: URI.file('/workspace/sample'), presence: 'absent' },
		});
		assert.deepStrictEqual(result.python.interpreter, { kind: 'folder-relative', source: 'workspace-folder', presence: 'absent' });
	});

	test('distinguishes global path presence from an unresolved or unchecked interpreter', () => {
		const markers = { 'requirements.txt': 'file' } as const;
		const settings = [
			{ kind: 'absolute', source: 'user', presence: 'present' },
			{ kind: 'absolute', source: 'user', presence: 'unknown' },
			{ kind: 'unresolved', source: 'workspace' },
			undefined,
		] as const;
		assert.deepStrictEqual(settings.map(pythonInterpreter => evaluateLocal({ folder, markers, pythonInterpreter }).python.interpreter), [
			{ kind: 'absolute', source: 'user', presence: 'present' },
			{ kind: 'absolute', source: 'user', presence: 'unknown' },
			{ kind: 'unresolved', source: 'workspace' },
			{ kind: 'unknown' },
		]);
	});

	test('keeps C and Python evidence in a mixed root and preserves an explicit global setting alongside .venv', () => {
		const result = evaluateLocal({
			folder,
			markers: { '.venv': 'directory', Makefile: 'file', 'compile_commands.json': 'file' },
			pythonInterpreter: { kind: 'absolute', source: 'user', presence: 'absent' },
		});
		assert.deepStrictEqual({ interpreter: result.python.interpreter, review: result.review }, {
			interpreter: { kind: 'absolute', source: 'user', presence: 'absent' },
			review: ['python-interpreter', 'c-build-configuration', 'c-compilation-database'],
		});
	});

	test('keeps roots with the same name independent and rejects an interpreter fact anchored to another root', () => {
		const cFolder = URI.file('/workspace/first/sample');
		const pythonFolder = URI.file('/workspace/second/sample');
		const pythonInterpreter = Object.freeze({ kind: 'folder-relative', source: 'workspace', baseFolder: pythonFolder, presence: 'present' } as const);
		const cRoot = Object.freeze({ folder: cFolder, markers: Object.freeze({ Makefile: 'file' } as const), pythonInterpreter });
		const pythonRoot = Object.freeze({ folder: pythonFolder, markers: Object.freeze({ 'pyproject.toml': 'file' } as const), pythonInterpreter });
		const snapshot = Object.freeze({ isTrusted: true, folders: Object.freeze([cRoot, pythonRoot]) });
		const result = evaluateProjectReadiness(snapshot);
		assert.deepStrictEqual(result.folders.map(root => root.kind === 'local' ? { folder: root.folder, interpreter: root.python.interpreter, review: root.review } : root), [
			{ folder: cFolder, interpreter: { kind: 'different-folder', source: 'workspace' }, review: ['c-build-configuration'] },
			{ folder: pythonFolder, interpreter: { kind: 'folder-relative', source: 'workspace', presence: 'present' }, review: ['python-interpreter'] },
		]);
		assert.deepStrictEqual(evaluateProjectReadiness(snapshot), result);
		assert.deepStrictEqual(evaluateProjectReadiness({ isTrusted: true, folders: [pythonRoot, cRoot] }).folders, [...result.folders].reverse());
	});

	test('keeps absent and unchecked root markers distinct and ignores unrelated markers', () => {
		const markers = { 'requirements.txt': 'absent', '.venv': 'absent', 'CMakeLists.txt': 'unknown', 'package.json': 'file' } as const;
		const result = evaluateLocal({ folder, markers });
		assert.deepStrictEqual({ python: result.python, c: result.c, review: result.review }, {
			python: {
				markers: { 'pyproject.toml': 'unknown', 'requirements.txt': 'absent', '.venv': 'absent' },
				interpreter: { kind: 'unknown' },
			},
			c: { buildMarkers: { 'CMakeLists.txt': 'unknown', Makefile: 'unknown' }, compilationDatabase: 'unknown' },
			review: [],
		});
	});

	test('does not treat the wrong entry type or an unverified link as a marker', () => {
		const result = evaluateLocal({ folder, markers: { 'pyproject.toml': 'unverified-link', '.venv': 'file', Makefile: 'directory', 'compile_commands.json': 'unverified-link' } });
		assert.deepStrictEqual({ python: result.python.markers, c: result.c, review: result.review }, {
			python: { 'pyproject.toml': 'unverified-link', 'requirements.txt': 'unknown', '.venv': 'wrong-type' },
			c: { buildMarkers: { 'CMakeLists.txt': 'unknown', Makefile: 'wrong-type' }, compilationDatabase: 'unverified-link' },
			review: [],
		});
	});

	test('reports an empty workspace and a root with all markers absent without a project verdict', () => {
		assert.deepStrictEqual(evaluateProjectReadiness({ isTrusted: true, folders: [] }), { execution: 'outside-assessment', folders: [] });
		const emptyRoot = evaluateLocal({
			folder,
			markers: { 'pyproject.toml': 'absent', 'requirements.txt': 'absent', '.venv': 'absent', 'CMakeLists.txt': 'absent', Makefile: 'absent', 'compile_commands.json': 'absent' },
			pythonInterpreter: { kind: 'absolute', source: 'user', presence: 'present' },
		});
		assert.deepStrictEqual(emptyRoot.review, []);
	});

	test('leaves remote, virtual, and file authority roots unassessed', () => {
		const remote = URI.parse('vscode-remote://ssh-remote+example/workspace');
		const virtual = URI.parse('virtual:/workspace');
		const unc = URI.parse('file://files.example/workspace');
		const folders = [remote, virtual, unc].map(folder => ({ folder, markers: { Makefile: 'file' } as const }));
		assert.deepStrictEqual(evaluateProjectReadiness({ isTrusted: true, folders }).folders, [
			{ folder: remote, kind: 'unsupported-root', reason: 'non-file-scheme' },
			{ folder: virtual, kind: 'unsupported-root', reason: 'non-file-scheme' },
			{ folder: unc, kind: 'unsupported-root', reason: 'file-authority' },
		]);
	});

	test('only returns advisory evidence in restricted mode even if all supplied observations are positive', () => {
		const folders: ProjectReadinessSnapshot['folders'] = [{
			folder,
			markers: { 'pyproject.toml': 'file', 'requirements.txt': 'file', '.venv': 'directory', 'CMakeLists.txt': 'file', Makefile: 'file', 'compile_commands.json': 'file' },
			pythonInterpreter: { kind: 'absolute', source: 'user', presence: 'present' },
		}];
		const trusted = evaluateProjectReadiness({ isTrusted: true, folders });
		assert.deepStrictEqual(evaluateProjectReadiness({ isTrusted: false, folders }), {
			execution: 'blocked-by-workspace-trust',
			folders: trusted.folders,
		});
	});
});
