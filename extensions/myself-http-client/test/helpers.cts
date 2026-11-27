/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const { readFileSync } = require('node:fs');
const { createRequire, wrap } = require('node:module');
const { runInThisContext } = require('node:vm');

function loadWith(file, overrides) {
	const path = require.resolve('../out/' + file);
	const localRequire = createRequire(path);
	const module = { exports: {} };
	const program = runInThisContext(wrap(readFileSync(path, 'utf8')), { filename: path });
	program(module.exports, name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name), module);
	return module.exports;
}

module.exports = { loadWith };
