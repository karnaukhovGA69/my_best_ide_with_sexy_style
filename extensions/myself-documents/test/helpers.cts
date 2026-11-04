/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const Module = require('node:module');
const path = require('node:path');
function loadWithVscode(file, vscode) {
	const original = Module._load;
	Module._load = (id, parent, isMain) => id === 'vscode' ? vscode : original(id, parent, isMain);
	try {
		const resolved = require.resolve(path.join(__dirname, '..', 'out', file));
		delete require.cache[resolved];
		return require(resolved);
	} finally {
		Module._load = original;
	}
}
function emitter() {
	const listeners = new Set();
	return { event: listener => { listeners.add(listener); return { dispose: () => listeners.delete(listener) }; }, fire: value => { for (const listener of listeners) { listener(value); } }, listeners };
}
function uri(value) {
	return { path: value, toString: () => value };
}
const viewApi = { Uri: { joinPath: (root, ...parts) => uri(root.path + '/' + parts.join('/')) }, env: { language: 'en' }, l10n: { t: text => text } };
module.exports = { loadWithVscode, emitter, uri, viewApi };
