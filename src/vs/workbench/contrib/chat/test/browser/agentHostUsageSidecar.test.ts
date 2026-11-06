/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Schemas } from '../../../../../base/common/network.js';
import { dirname } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createInMemoryFileService } from '../../../../../platform/files/test/common/inMemoryFileService.js';
import { buildAgentHostUsageUri, readAgentHostUsageRecords } from '../../browser/chatDebug/agentHostUsageSidecar.js';

suite('Agent host usage sidecar history', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('reads legacy and versioned records without rewriting existing data', async () => {
		const files = createInMemoryFileService(store, Schemas.file);
		const uri = buildAgentHostUsageUri(URI.file('/history'), 'session');
		const legacy = { turnId: 'legacy', inputTokens: 3, ts: '2026-01-01T00:00:00.000Z' };
		const current = { schemaVersion: 2, sdkSessionId: 'session', eventId: 'call', apiCallId: 'call', turnId: 'current', inputTokens: 7, ts: '2026-01-01T00:01:00.000Z' };
		const contents = `${JSON.stringify(legacy)}\nnot-json\n\n${JSON.stringify(current)}\n`;
		await files.createFolder(dirname(uri));
		await files.writeFile(uri, VSBuffer.fromString(contents));
		const records = await readAgentHostUsageRecords(files, uri);
		assert.deepStrictEqual(records.map(record => [record.turnId, record.inputTokens, record.schemaVersion]), [['legacy', 3, undefined], ['current', 7, 2]]);
		assert.strictEqual((await files.readFile(uri)).value.toString(), contents);
	});

	test('tolerates missing and malformed history without creating or deleting files', async () => {
		const files = createInMemoryFileService(store, Schemas.file);
		const uri = buildAgentHostUsageUri(URI.file('/history'), 'session');
		assert.deepStrictEqual(await readAgentHostUsageRecords(files, uri), []);
		assert.strictEqual(await files.exists(uri), false);
		await files.createFolder(dirname(uri));
		await files.writeFile(uri, VSBuffer.fromString('not-json'));
		assert.deepStrictEqual(await readAgentHostUsageRecords(files, uri), []);
		assert.strictEqual((await files.readFile(uri)).value.toString(), 'not-json');
	});
});
