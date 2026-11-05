/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ISetting, ISettingsEditorModel, ISettingsGroup } from '../../../../services/preferences/common/preferences.js';
import { PreferencesSearchService } from '../../browser/preferencesSearch.js';
import { TF_IDF_SEARCH_PROVIDER_NAME } from '../../common/preferences.js';

suite('Local settings search distribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(ranking = true): PreferencesSearchService {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.stub(IConfigurationService, new TestConfigurationService({ workbench: { settings: { enableNaturalLanguageSearch: ranking } } }));
		return store.add(instantiation.createInstance(PreferencesSearchService));
	}

	function setting(key: string, description = ''): ISetting {
		return { key, type: 'number', value: 14, description: [description], keyRange: new Range(1, 1, 1, key.length + 1), range: new Range(1, 1, 3, 1), valueRange: new Range(2, 1, 2, 3), descriptionRanges: [new Range(3, 1, 3, description.length + 1)] };
	}

	function model(settings: ISetting[]): ISettingsEditorModel {
		const group = upcastPartial<ISettingsGroup>({ id: 'editor', title: 'Editor', sections: [{ settings }] });
		return upcastPartial<ISettingsEditorModel>({
			settingsGroups: [group],
			filterSettings: (_filter, _groupFilter, matcher) => settings.flatMap(setting => {
				const match = matcher(setting, group);
				return match ? [{ setting, ...match }] : [];
			})
		});
	}

	test('never constructs an AI search provider even when ranking is enabled', () => {
		assert.strictEqual(createService().getAiSearchProvider('font'), undefined);
	});

	test('ordinary local search preserves exact key matches', async () => {
		const result = await createService().getLocalSearchProvider('editor.fontSize').searchModel(model([setting('editor.fontSize', 'Size of the editor font'), setting('window.zoomLevel', 'Window zoom')]), CancellationToken.None);
		assert.strictEqual(result?.exactMatch, true);
		assert.deepStrictEqual(result?.filterMatches.map(match => match.setting.key), ['editor.fontSize']);
	});

	test('keeps local ranking optional', () => {
		assert.strictEqual(createService(false).getRemoteSearchProvider('font'), undefined);
	});

	for (const scenario of ['empty catalog', 'unmatched query', 'cancelled query'] as const) {
		test(`local ranking safely handles ${scenario}`, async () => {
			const provider = createService().getRemoteSearchProvider('nonexistentword')!;
			const preferences = model(scenario === 'empty catalog' ? [] : [setting('editor.fontSize', 'Size of text')]);
			const result = await provider.searchModel(preferences, scenario === 'cancelled query' ? CancellationToken.Cancelled : CancellationToken.None);
			assert.deepStrictEqual(result, { filterMatches: [], exactMatch: false });
		});
	}

	test('local ranking still finds a relevant description without any AI service', async () => {
		const preferences = model([
			setting('editor.fontSize', 'Text rendering font configuration font family font size font ligatures font typography'),
			...Array.from({ length: 20 }, (_, index) => setting(`other.preference${index}`, 'Unrelated appearance option'))
		]);
		const result = await createService().getRemoteSearchProvider('font')!.searchModel(preferences, CancellationToken.None);
		assert.deepStrictEqual(result?.filterMatches.map(match => ({ key: match.setting.key, provider: match.providerName })), [{ key: 'editor.fontSize', provider: TF_IDF_SEARCH_PROVIDER_NAME }]);
	});
});
