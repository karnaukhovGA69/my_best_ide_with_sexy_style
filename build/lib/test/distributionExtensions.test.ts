/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { suite, test } from 'node:test';
import { isDistributionExtension, isDistributionExtensionFile } from '../distributionExtensions.ts';

const extensionsRoot = path.resolve(import.meta.dirname, '../../../extensions');

suite('Myself IDE extension distribution', () => {
	test('keeps required features and their extension dependencies without programming language packages', () => {
		const folders = readdirSync(extensionsRoot).filter(isDistributionExtension);
		const languages: string[] = [];
		const missingDependencies: string[] = [];
		for (const folder of folders) {
			const manifest = JSON.parse(readFileSync(path.join(extensionsRoot, folder, 'package.json'), 'utf8')) as {
				extensionDependencies?: string[];
				contributes?: { languages?: { id: string }[] };
			};
			languages.push(...(manifest.contributes?.languages ?? []).map(language => language.id));
			missingDependencies.push(...(manifest.extensionDependencies ?? []).filter(id => !isDistributionExtension(id.replace(/^vscode\./, ''))));
		}

		assert.deepStrictEqual({
			requiredFeatures: ['git', 'git-base', 'configuration-editing', 'extension-editing', 'myself-documents', 'npm', 'markdown-basics', 'markdown-language-features', 'markdown-math', 'mermaid-markdown-features'].filter(name => !folders.includes(name)),
			missingDependencies,
			languages: [...new Set(languages)].sort(),
		}, {
			requiredFeatures: [],
			missingDependencies: [],
			languages: ['diff', 'git-commit', 'git-rebase', 'ignore', 'json', 'jsonc', 'log', 'markdown', 'markdown-math', 'properties', 'search-result'],
		});
	});

	test('rejects excluded packages and unreviewed upstream additions', () => {
		assert.deepStrictEqual([
			'github', 'github-authentication', 'copilot', 'GitHub.copilot-chat', 'prompt-basics', 'emmet', 'grunt', 'gulp', 'jake',
			'tunnel-forwarding', 'myself-github', 'remote-ssh', 'remote-server',
			'go', 'rust', 'cpp', 'fsharp', 'lua', 'json', 'json-language-features', 'yaml', 'sql',
			'javascript', 'typescript-basics', 'typescript-language-features', 'new-upstream-extension',
		].filter(isDistributionExtension), []);
	});

	test('filters stale build output including shared TypeScript and Windows paths', () => {
		assert.deepStrictEqual([
			'git/package.json', 'git/node_modules/@vscode/fs-copyfile/package.json',
			'markdown-math/notebook-out/index.js', 'github-authentication/dist/extension.js', 'github/dist/extension.js',
			'copilot/dist/extension.js', 'node_modules/typescript/lib/typescript.js',
			'tunnel-forwarding/out/extension.js', 'tunnel-forwarding\\package.json',
			'go/syntaxes/go.tmLanguage.json', 'emmet/dist/node/emmetNodeMain.js',
			'grunt\\package.json', 'markdown-basics\\package.json',
		].filter(isDistributionExtensionFile), [
			'git/package.json', 'git/node_modules/@vscode/fs-copyfile/package.json',
			'markdown-math/notebook-out/index.js',
			'markdown-basics\\package.json',
		]);
	});
});
