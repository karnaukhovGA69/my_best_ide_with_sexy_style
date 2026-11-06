/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ToolResultCompressorService } from '../../../browser/tools/toolResultCompressorService.js';
import { LanguageModelPartAudience } from '../../../common/languageModels.js';
import { IToolResult } from '../../../common/tools/languageModelToolsService.js';
import { IToolResultCache, IToolResultFilter } from '../../../common/tools/toolResultCompressor.js';

suite('ToolResultCompressorService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): ToolResultCompressorService {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		return store.add(instantiation.createInstance(ToolResultCompressorService));
	}

	test('does not inspect or retain filters, caches, tool input, or results', () => {
		const service = createService();
		const unreadable = { get() { throw new Error('Compression must not inspect data'); } };
		service.registerFilter(new Proxy({} as IToolResultFilter, unreadable));
		service.registerCache(new Proxy({} as IToolResultCache, unreadable));
		assert.strictEqual(service.maybeCompress('run_in_terminal', new Proxy({}, unreadable), new Proxy({} as IToolResult, unreadable)), undefined);
	});

	test('preserves long text, attachments, and audience metadata across repeated calls', () => {
		const service = createService();
		const text = 'unchanged output\n'.repeat(200);
		const audience = [LanguageModelPartAudience.Assistant, LanguageModelPartAudience.User];
		const data = VSBuffer.wrap(new Uint8Array([1, 2, 3]));
		const result: IToolResult = { content: [
			{ kind: 'text', value: text, audience, title: 'Output' },
			{ kind: 'data', value: { mimeType: 'application/octet-stream', data } },
		] };
		for (let call = 0; call < 2; call++) {
			assert.strictEqual(service.maybeCompress('run_in_terminal', {}, result), undefined);
		}
		assert.deepStrictEqual(result.content, [
			{ kind: 'text', value: text, audience, title: 'Output' },
			{ kind: 'data', value: { mimeType: 'application/octet-stream', data } },
		]);
	});
});
