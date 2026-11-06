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
import { buildAgentHostCustomizationsUri, readAgentHostCustomizationsSnapshot } from '../../browser/chatDebug/agentHostUsageSidecar.js';

suite('Agent host customization sidecar history', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('reads an existing snapshot without rewriting it', async () => {
		const files = createInMemoryFileService(store, Schemas.file);
		const uri = buildAgentHostCustomizationsUri(URI.file('/history'), 'session');
		const snapshot = [{ type: 'skill', id: 'local', uri: 'file:///history/skill.md', name: 'Local skill', enabled: true }];
		const contents = JSON.stringify(snapshot, null, 2);
		await files.createFolder(dirname(uri));
		await files.writeFile(uri, VSBuffer.fromString(contents));
		assert.deepStrictEqual(await readAgentHostCustomizationsSnapshot(files, uri), snapshot);
		assert.strictEqual((await files.readFile(uri)).value.toString(), contents);
	});

	test('tolerates missing and malformed snapshots without creating or deleting files', async () => {
		const files = createInMemoryFileService(store, Schemas.file);
		const uri = buildAgentHostCustomizationsUri(URI.file('/history'), 'session');
		assert.strictEqual(await readAgentHostCustomizationsSnapshot(files, uri), undefined);
		assert.strictEqual(await files.exists(uri), false);
		await files.createFolder(dirname(uri));
		await files.writeFile(uri, VSBuffer.fromString('not-json'));
		assert.strictEqual(await readAgentHostCustomizationsSnapshot(files, uri), undefined);
		assert.strictEqual((await files.readFile(uri)).value.toString(), 'not-json');
	});
});
