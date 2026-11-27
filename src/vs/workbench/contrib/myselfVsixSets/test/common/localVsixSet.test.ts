/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { localVsixSetMaxBytes, localVsixSetMaxEntries, parseLocalVsixSet } from '../../common/localVsixSet.js';

suite('Local VSIX set manifest', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const encoder = new TextEncoder();
	const entry = { id: 'publisher.extension', version: '1.2.3-rc.1+arm64', file: 'Extension-1.2.3.VSIX', sha256: 'AB'.repeat(32) };
	const parse = (entries: readonly object[]) => parseLocalVsixSet(encoder.encode(JSON.stringify({ version: 1, entries })));

	test('accepts exact release and prerelease versions and normalizes the declared hash', () => {
		const release = { ...entry, id: 'publisher.release', version: '2.0.0', file: 'release.vsix' };
		assert.deepStrictEqual(parse([entry, release]), {
			set: { version: 1, entries: [{ ...entry, sha256: entry.sha256.toLowerCase() }, { ...release, sha256: release.sha256.toLowerCase() }] },
		});
	});

	test('rejects malformed UTF-8 and permissive JSON syntax', () => {
		for (const bytes of [new Uint8Array([0xff, 0xfe]), encoder.encode('{'), encoder.encode('{"version":1,"entries":[],}'), encoder.encode('// jsonc\n{}')]) {
			assert.deepStrictEqual(parseLocalVsixSet(bytes), { issue: { kind: 'json' } });
		}
	});

	test('rejects unknown schema versions, duplicate JSON keys, and extra fields', () => {
		for (const text of ['{"version":2,"entries":[]}', '{"version":2,"version":1,"entries":[]}', '{"version":1,"entries":[],"url":"https://example.invalid"}', '{"version":1,"entries":{}}']) {
			assert.deepStrictEqual(parseLocalVsixSet(encoder.encode(text)), { issue: { kind: 'schema' } });
		}
		const duplicateVersion = JSON.stringify({ version: 1, entries: [entry] }).replace('"version":"1.2.3-rc.1+arm64"', '"version":"0.0.1","version":"1.2.3-rc.1+arm64"');
		assert.deepStrictEqual(parseLocalVsixSet(encoder.encode(duplicateVersion)), { issue: { kind: 'entry', entryNumber: 1 } });
	});

	test('enforces manifest byte and package count limits', () => {
		assert.deepStrictEqual(parseLocalVsixSet(new Uint8Array(localVsixSetMaxBytes + 1)), { issue: { kind: 'size' } });
		assert.deepStrictEqual(parse([]), { issue: { kind: 'entryCount' } });
		assert.deepStrictEqual(parse(Array(localVsixSetMaxEntries + 1).fill(entry)), { issue: { kind: 'entryCount' } });
	});

	test('rejects version ranges, invalid identifiers and hashes, and filename escapes', () => {
		const invalidEntries = [
			{ id: 'publisher/extension' }, { id: '<script>' }, { id: 'publisher.extension\n' },
			{ version: '^1.2.3' }, { version: 'latest' }, { version: 'v1.2.3' }, { version: '1.2.3 ' }, { version: '01.2.3' },
			{ sha256: 'f'.repeat(63) }, { sha256: 'g'.repeat(64) }, { sha256: 'f'.repeat(64) + '\n' },
			{ file: '../item.vsix' }, { file: '/tmp/item.vsix' }, { file: 'C:\\item.vsix' }, { file: 'sub/item.vsix' },
			{ file: 'https://example.invalid/item.vsix' }, { file: 'file:///tmp/item.vsix' }, { file: 'encoded%2fitem.vsix' },
			{ file: '..\\item.vsix' }, { file: 'archive.vsix:other.vsix' }, { file: 'CON.vsix' }, { file: 'item.vsix\n' },
			{ file: '<img>.vsix' }, { file: 'item.vsix?x' }, { url: 'https://example.invalid/item.vsix' },
		];
		for (const fields of invalidEntries) {
			assert.deepStrictEqual(parse([{ ...entry, ...fields }]), { issue: { kind: 'entry', entryNumber: 1 } }, JSON.stringify(fields));
		}
	});

	test('treats differently cased IDs and filenames as duplicates', () => {
		assert.deepStrictEqual(parse([entry, { ...entry, id: entry.id.toUpperCase(), file: 'different.vsix' }]), { issue: { kind: 'duplicateId', entryNumber: 2 } });
		assert.deepStrictEqual(parse([entry, { ...entry, id: 'other.extension', file: entry.file.toLowerCase() }]), { issue: { kind: 'duplicateFile', entryNumber: 2 } });
	});
});
