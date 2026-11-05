/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { Extensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditTelemetryContribution } from '../../browser/editTelemetryContribution.js';
import { AI_STATS_SETTING_ID, EDIT_TELEMETRY_SETTING_ID } from '../../browser/settingIds.js';
import { EDIT_TELEMETRY_DETAILS_SETTING_ID, EDIT_TELEMETRY_SHOW_DECORATIONS, EDIT_TELEMETRY_SHOW_STATUS_BAR } from '../../browser/settings.js';
import '../../browser/editTelemetry.contribution.js';

suite('Edit statistics distribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('startup needs no configuration, telemetry, workspace or chat services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		store.add(instantiation.createInstance(EditTelemetryContribution));
	});

	test('AI statistics and edit telemetry settings are not exposed', () => {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		for (const key of [AI_STATS_SETTING_ID, EDIT_TELEMETRY_SETTING_ID, EDIT_TELEMETRY_DETAILS_SETTING_ID, EDIT_TELEMETRY_SHOW_DECORATIONS, EDIT_TELEMETRY_SHOW_STATUS_BAR]) {
			assert.strictEqual(properties[key], undefined, key);
		}
	});

	test('Git compatibility commands accept resources without tracking or modifying them', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		store.add(instantiation.createInstance(EditTelemetryContribution));
		const resources = Object.freeze([Object.freeze({ scheme: 'file', path: '/workspace/example.ts' })]);
		const before = JSON.stringify(resources);
		for (const level of ['repository', 'file', 'line']) {
			assert.strictEqual(instantiation.invokeFunction(CommandsRegistry.getCommand('_aiEdits.hasAiContributions')!.handler, resources, level), false);
		}
		assert.strictEqual(instantiation.invokeFunction(CommandsRegistry.getCommand('_aiEdits.clearAiContributions')!.handler, resources), undefined);
		assert.strictEqual(instantiation.invokeFunction(CommandsRegistry.getCommand('_aiEdits.clearAllAiContributions')!.handler), undefined);
		assert.strictEqual(JSON.stringify(resources), before);
	});

	test('disposing compatibility contribution restores previous command registrations', () => {
		const ids = ['_aiEdits.hasAiContributions', '_aiEdits.clearAiContributions', '_aiEdits.clearAllAiContributions'];
		const before = ids.map(id => CommandsRegistry.getCommand(id));
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const contribution = store.add(instantiation.createInstance(EditTelemetryContribution));
		assert.ok(ids.every(id => CommandsRegistry.getCommand(id)));
		contribution.dispose();
		assert.deepStrictEqual(ids.map(id => CommandsRegistry.getCommand(id)), before);
	});
});
