/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('production packaging retains the document webview resource path', () => {
	const output = fs.mkdtempSync(path.join(os.tmpdir(), 'myself-documents-package-'));
	try {
		execFileSync(process.execPath, [path.join(__dirname, '..', 'esbuild.webview.mts'), '--outputRoot', output], { stdio: 'pipe' });
		assert.ok(fs.statSync(path.join(output, 'out', 'webview', 'editor.js')).size > 0);
		assert.ok(fs.statSync(path.join(output, 'out', 'webview', 'library.js')).size > 0);
		assert.equal(fs.existsSync(path.join(output, 'webview', 'editor.js')), false);
	} finally {
		fs.rmSync(output, { recursive: true, force: true });
	}
});
