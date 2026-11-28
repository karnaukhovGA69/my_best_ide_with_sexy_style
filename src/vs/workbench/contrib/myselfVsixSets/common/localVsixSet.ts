/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isValidBasename } from '../../../../base/common/extpath.js';
import { parseTree, type Node, type ParseError } from '../../../../base/common/json.js';
import { parse } from '../../../../base/common/semver/semver.js';
import { EXTENSION_IDENTIFIER_REGEX } from '../../../../platform/extensionManagement/common/extensionManagement.js';

export const localVsixSetMaxBytes = 64 * 1024;
export const localVsixSetMaxEntries = 32;

export interface ILocalVsixSetEntry {
	readonly id: string;
	readonly version: string;
	readonly file: string;
	readonly sha256: string;
}

export interface ILocalVsixSet {
	readonly version: 1;
	readonly entries: readonly ILocalVsixSetEntry[];
}

export type LocalVsixSetIssue =
	| { readonly kind: 'size' | 'json' | 'schema' | 'entryCount' }
	| { readonly kind: 'entry' | 'duplicateId' | 'duplicateFile'; readonly entryNumber: number };

type LocalVsixSetResult = { readonly set: ILocalVsixSet } | { readonly issue: LocalVsixSetIssue };

/** Read exactly the expected object fields and reject duplicate JSON keys. */
function readFields(node: Node | undefined, expected: readonly string[]): Map<string, Node> | undefined {
	if (node?.type !== 'object' || node.children?.length !== expected.length) {
		return undefined;
	}
	const fields = new Map<string, Node>();
	for (const property of node.children) {
		const [key, value] = property.children ?? [];
		if (typeof key?.value !== 'string' || !value || !expected.includes(key.value) || fields.has(key.value)) {
			return undefined;
		}
		fields.set(key.value, value);
	}
	return fields;
}

export function parsePinnedVsixVersion(value: string) {
	if (value.length > 64) {
		return undefined;
	}
	const version = parse(value);
	return version && value === version.version + (version.build.length ? `+${version.build.join('.')}` : '') ? version : undefined;
}

export function isLocalVsixArchiveBasename(filename: string): boolean {
	return /^[a-z0-9][a-z0-9._+-]{0,122}\.vsix$/i.test(filename) && isValidBasename(filename, true);
}

function readEntry(node: Node): ILocalVsixSetEntry | undefined {
	const fields = readFields(node, ['id', 'version', 'file', 'sha256']);
	const id: unknown = fields?.get('id')?.value;
	const version: unknown = fields?.get('version')?.value;
	const file: unknown = fields?.get('file')?.value;
	const sha256: unknown = fields?.get('sha256')?.value;
	if (typeof id !== 'string' || id.length > 128 || id.trim() !== id || !EXTENSION_IDENTIFIER_REGEX.test(id)
		|| typeof version !== 'string' || !parsePinnedVsixVersion(version)
		|| typeof file !== 'string' || !isLocalVsixArchiveBasename(file)
		|| typeof sha256 !== 'string' || sha256.length !== 64 || !/^[a-f0-9]+$/i.test(sha256)) {
		return undefined;
	}
	return { id, version, file, sha256: sha256.toLowerCase() };
}

/** Validate manifest bytes before exposing any of the fields as package declarations. */
export function parseLocalVsixSet(bytes: Uint8Array): LocalVsixSetResult {
	if (bytes.byteLength > localVsixSetMaxBytes) {
		return { issue: { kind: 'size' } };
	}
	let root: Node | undefined;
	const errors: ParseError[] = [];
	try {
		const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
	} catch {
		return { issue: { kind: 'json' } };
	}
	if (!root || errors.length) {
		return { issue: { kind: 'json' } };
	}

	const fields = readFields(root, ['version', 'entries']);
	const entryArray = fields?.get('entries');
	if (fields?.get('version')?.value !== 1 || entryArray?.type !== 'array' || !entryArray.children) {
		return { issue: { kind: 'schema' } };
	}
	if (!entryArray.children.length || entryArray.children.length > localVsixSetMaxEntries) {
		return { issue: { kind: 'entryCount' } };
	}

	const entries: ILocalVsixSetEntry[] = [];
	const ids = new Set<string>();
	const files = new Set<string>();
	for (const [index, node] of entryArray.children.entries()) {
		const entryNumber = index + 1;
		const entry = readEntry(node);
		if (!entry) {
			return { issue: { kind: 'entry', entryNumber } };
		}
		const id = entry.id.toLowerCase();
		const file = entry.file.toLowerCase();
		if (ids.has(id)) {
			return { issue: { kind: 'duplicateId', entryNumber } };
		}
		if (files.has(file)) {
			return { issue: { kind: 'duplicateFile', entryNumber } };
		}
		ids.add(id);
		files.add(file);
		entries.push(entry);
	}
	return { set: { version: 1, entries } };
}
