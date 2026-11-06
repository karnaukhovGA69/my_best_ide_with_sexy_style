/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../../platform/instantiation/common/serviceCollection.js';
import { IUntitledTextResourceEditorInput } from '../../../../../../common/editor.js';
import { IEditorService } from '../../../../../../services/editor/common/editorService.js';
import { ChatCodeCitationContentPart } from '../../../../browser/widget/chatContentParts/chatCodeCitationContentPart.js';
import { IChatContentPartRenderContext } from '../../../../browser/widget/chatContentParts/chatContentParts.js';

suite('ChatCodeCitationContentPart', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('opens preserved citations in a local editor without telemetry services', () => {
		const opened: IUntitledTextResourceEditorInput[] = [];
		const editorService = {
			openEditor: async (input: IUntitledTextResourceEditorInput) => { opened.push(input); return undefined; }
		} as IEditorService;
		const instantiation = store.add(new InstantiationService(new ServiceCollection([IEditorService, editorService]), true));
		const context = new Proxy({} as IChatContentPartRenderContext, { get() { throw new Error('Context must not be read'); } });
		const value = URI.file('/citations/example.ts');
		const part = store.add(instantiation.createInstance(ChatCodeCitationContentPart, {
			kind: 'codeCitations',
			citations: [{ kind: 'codeCitation', value, license: 'MIT', snippet: 'const answer = 42;' }]
		}, context));
		part.domNode.querySelector<HTMLElement>('.monaco-button')!.click();
		assert.deepStrictEqual(opened, [{
			resource: undefined,
			contents: `# Code Citations\n\n## License: MIT\n${value.toString()}\n\n\`\`\`\nconst answer = 42;\n\`\`\`\n\n`,
			languageId: 'markdown'
		}]);
	});
});
