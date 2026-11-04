/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDistributionRuntimeFile } from '../distributionRuntime.ts';

test('excludes standalone AI executables and assets, including Windows paths', () => {
	const paths = [
		'vs/sessions/sessions.desktop.main.js',
		'vs/sessions/electron-browser/sessions.html',
		'vs/platform/agentHost/node/agentHostMain',
		'vs\\platform\\localTranscription\\node\\localTranscriptionMain.js',
	];
	assert.deepStrictEqual(paths.map(isDistributionRuntimeFile), [false, false, false, false]);
});

test('keeps the editor, extension host, PTY and shared interfaces', () => {
	const paths = [
		'main.js',
		'vs/workbench/workbench.desktop.main.js',
		'vs/workbench/api/node/extensionHostProcess.js',
		'vs/platform/terminal/node/ptyHostMain.js',
		'vs/workbench/services/agentHost/common/agentHostResourceService.js',
		'vs/platform/agentHostOther/worker.js',
	];
	assert.deepStrictEqual(paths.map(isDistributionRuntimeFile), [true, true, true, true, true, true]);
});
