/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
	getPreviewFormat, maxCsvColumns, maxCsvRows, maxInputBytes, maxJsonDepth, maxJsonValues,
	maxOutputBytes, parsePreview, PreviewError,
} = require('../out/model.js');
const { renderPreview } = require('../out/view.js');

const labels = { title: 'Preview', language: 'en', snapshot: 'Snapshot', array: 'Array', object: 'Object', row: 'Row', emptyCsv: 'Empty CSV' };
const hasCode = code => error => error instanceof PreviewError && error.code === code;

test('recognizes local JSON and CSV files and rejects virtual and unsupported formats', () => {
	assert.equal(getPreviewFormat('file', '', '/sample/ITEMS.JSON'), 'json');
	assert.equal(getPreviewFormat('file', '', '/sample/list.csv'), 'csv');
	for (const args of [['file', 'remote', '/list.csv'], ['untitled', '', '/input.json'], ['file', '', '/config.jsonc'], ['https', '', '/doc.json']]) {
		assert.equal(getPreviewFormat(...args), undefined);
	}
});

test('preserves CSV commas, doubled quotes, multiline cells, empty fields and record boundaries', () => {
	assert.deepEqual(parsePreview('csv', '\uFEFF"A, B","first ""quoted"" line\r\nsecond",\r\nx,y,z\rsolo\n'), {
		format: 'csv', rows: [['A, B', 'first "quoted" line\r\nsecond', ''], ['x', 'y', 'z'], ['solo']],
	});
	assert.deepEqual(parsePreview('csv', '""'), { format: 'csv', rows: [['']] });
	assert.deepEqual(parsePreview('csv', ''), { format: 'csv', rows: [] });
});

test('rejects malformed CSV quotes and reports row and column limits', () => {
	for (const text of ['"unterminated', '"closed"tail', 'unquoted"bad"']) {
		assert.throws(() => parsePreview('csv', text), hasCode('invalid-csv'));
	}
	assert.doesNotThrow(() => parsePreview('csv', 'x\n'.repeat(maxCsvRows)));
	assert.throws(() => parsePreview('csv', 'x\n'.repeat(maxCsvRows + 1)), hasCode('csv-rows'));
	assert.doesNotThrow(() => parsePreview('csv', 'x,'.repeat(maxCsvColumns - 1) + 'x'));
	assert.throws(() => parsePreview('csv', 'x,'.repeat(maxCsvColumns) + 'x'), hasCode('csv-columns'));
});

test('renders expandable JSON and keeps numeric token spelling on the supported runtime', () => {
	const data = parsePreview('json', '{"objects":[{"label":"[{\\"}]", "id":9007199254740993}],"huge":1e400,"zero":-0,"decimal":0.1000000000000000001}');
	const html = renderPreview(data, labels);
	assert.match(html, /<details open><summary><span class="kind">Object \(4\)/);
	assert.match(html, /<details><summary><code>&quot;objects&quot;<\/code>: <span class="kind">Array \(1\)/);
	for (const token of ['9007199254740993', '1e400', '-0', '0.1000000000000000001']) {
		assert.ok(html.includes(`<code>${token}</code>`));
	}
});

test('rejects invalid JSON and bounds input bytes, nesting and values', () => {
	assert.throws(() => parsePreview('json', '{"bad":}'), hasCode('invalid-json'));
	assert.throws(() => parsePreview('json', '{"withComments":true /* comment */}'), hasCode('invalid-json'));
	assert.throws(() => parsePreview('json', '"' + '界'.repeat(Math.floor(maxInputBytes / 3) + 1) + '"'), hasCode('input-size'));
	assert.doesNotThrow(() => parsePreview('json', '['.repeat(maxJsonDepth) + '0' + ']'.repeat(maxJsonDepth)));
	assert.throws(() => parsePreview('json', '['.repeat(maxJsonDepth + 1) + '0' + ']'.repeat(maxJsonDepth + 1)), hasCode('json-depth'));
	assert.doesNotThrow(() => parsePreview('json', JSON.stringify(Array(maxJsonValues - 1).fill(null))));
	assert.throws(() => parsePreview('json', JSON.stringify(Array(maxJsonValues).fill(null))), hasCode('json-values'));
});

test('renders JSON keys, CSV formula text and markup as inert text under a restrictive CSP', () => {
	const json = renderPreview(parsePreview('json', '{"<b>&":"<em>example</em>"}'), { ...labels, title: '<test>"' });
	assert.match(json, /&lt;b&gt;&amp;/);
	assert.match(json, /&lt;em&gt;example&lt;\/em&gt;/);
	assert.match(json, /<h1>&lt;test&gt;&quot;<\/h1>/);
	const csv = renderPreview(parsePreview('csv', '"=1+2","<em>example</em>"'), labels);
	assert.match(csv, /<td>=1\+2<\/td><td>&lt;em&gt;example&lt;\/em&gt;<\/td>/);
	assert.match(csv, /default-src 'none'; style-src 'nonce-[A-Za-z0-9+/=]+'; base-uri 'none'; form-action 'none'/);
	assert.doesNotMatch(csv + json, /<em>|<script|<iframe|<a\s/);
});

test('bounds the actual HTML bytes after escaping', () => {
	const raw = '"' + '&'.repeat(Math.floor(maxOutputBytes / 5) + 1) + '"';
	assert.throws(() => renderPreview(parsePreview('json', raw), labels), hasCode('output-size'));
});
