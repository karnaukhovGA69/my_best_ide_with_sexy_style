/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { IRenameSymbolTrackerService, NullRenameSymbolTrackerService } from '../../../../../editor/browser/services/renameSymbolTrackerService.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { LanguageFeatureRegistry } from '../../../../../editor/common/languageFeatureRegistry.js';
import { RenameProvider, WorkspaceEdit } from '../../../../../editor/common/languages.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { rename } from '../../../../../editor/contrib/rename/browser/rename.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import '../../browser/renameSymbolTrackerService.js';

suite('Inline rename tracking distribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(instantiation: TestInstantiationService): IRenameSymbolTrackerService {
		const descriptor = getSingletonServiceDescriptors().findLast(([id]) => id === IRenameSymbolTrackerService)?.[1];
		assert.ok(descriptor);
		const service = instantiation.createInstance(descriptor);
		assert.ok(service instanceof NullRenameSymbolTrackerService);
		return service;
	}

	test('workbench uses the existing null tracker without editor or model services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		assert.strictEqual(createService(instantiation).trackedWord.get(), undefined);
	});

	test('never inspects code editors or subscribes to model events', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const forbidden = () => { throw new Error('Must not inspect editors or models'); };
		instantiation.set(ICodeEditorService, upcastPartial<ICodeEditorService>(new Proxy({}, { get: forbidden })));
		instantiation.set(IModelService, upcastPartial<IModelService>(new Proxy({}, { get: forbidden })));
		assert.strictEqual(createService(instantiation).trackedWord.get(), undefined);
	});

	test('ordinary language rename provider still prepares and returns edits', async () => {
		const model = store.add(createTextModel('const value = 1;', 'plaintext'));
		const registry = new LanguageFeatureRegistry<RenameProvider>();
		const range = new Range(1, 7, 1, 12);
		const calls: string[] = [];
		const edits: WorkspaceEdit = { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range, text: 'result' } }] };
		store.add(registry.register('*', {
			resolveRenameLocation: () => { calls.push('prepare'); return { range, text: 'value' }; },
			provideRenameEdits: (_model, _position, newName) => { calls.push(newName); return edits; }
		}));
		assert.strictEqual(await rename(registry, model, new Position(1, 7), 'result'), edits);
		assert.deepStrictEqual(calls, ['prepare', 'result']);
	});
});
