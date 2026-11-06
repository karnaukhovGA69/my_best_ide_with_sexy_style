/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import type { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { createFolderPickerTip, FOLDER_PICKER_TIP_CLASS } from '../../../browser/agentSessions/agentHost/agentHostFolderPickerTip.js';

suite('Agents folder picker tip disabled', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('retains list styling without reading storage or offering headers and links', () => {
		const storage = new Proxy({} as IStorageService, { get: () => { throw new Error('Storage must not be read'); } });
		const provider = createFolderPickerTip(storage);
		assert.deepStrictEqual(provider.getListOptions(), { widgetClassName: FOLDER_PICKER_TIP_CLASS });
		assert.deepStrictEqual(provider.getListOptions(), { widgetClassName: FOLDER_PICKER_TIP_CLASS });
	});
});
