/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { LocalTranscriptionModelState } from '../../../../../platform/localTranscription/common/localTranscription.js';
import { NullLocalTranscriptionService } from '../../browser/localTranscriptionService.js';

suite('Disabled local transcription', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('reports unavailable and rejects model activation', async () => {
		const service = new NullLocalTranscriptionService();
		assert.deepStrictEqual({ supported: service.isSupported, status: await service.getModelStatus() }, {
			supported: false,
			status: { state: LocalTranscriptionModelState.Error, error: 'unsupported' }
		});
		await assert.rejects(service.start(), /not supported/);
		await assert.rejects(service.importModel(), /not supported/);
	});

	test('audio and cleanup calls remain harmless without a worker', async () => {
		const service = new NullLocalTranscriptionService();
		await service.pushAudio(VSBuffer.fromString('audio'));
		await service.cancel();
		assert.strictEqual(await service.stop(), '');
	});
});
