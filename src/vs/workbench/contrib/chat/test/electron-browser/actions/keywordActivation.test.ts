/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { Extensions, IConfigurationRegistry } from '../../../../../../platform/configuration/common/configurationRegistry.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { Registry } from '../../../../../../platform/registry/common/platform.js';
import { KEYWORD_ACTIVIATION_SETTING_ID } from '../../../common/chatService/chatService.js';
import { KeywordActivationContribution } from '../../../electron-browser/actions/voiceChatActions.js';

suite('Keyword activation unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('can be constructed without speech or workbench services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiationService.createInstance(KeywordActivationContribution));
	});

	for (const value of ['inlineChat', 'quickChat', 'chatInView', 'chatInContext']) {
		test(`ignores persisted and changed keyword activation setting: ${value}`, async () => {
			const configurationService = new TestConfigurationService({ [KEYWORD_ACTIVIATION_SETTING_ID]: value });
			store.add(configurationService.onDidChangeConfigurationEmitter);
			const instantiationService = store.add(new InstantiationService(new ServiceCollection([IConfigurationService, configurationService]), true));
			const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
			const previousSetting = registry.getConfigurationProperties()[KEYWORD_ACTIVIATION_SETTING_ID];

			const contribution = store.add(instantiationService.createInstance(KeywordActivationContribution));
			assert.strictEqual(configurationService.onDidChangeConfigurationEmitter.hasListeners(), false);

			for (const nextValue of ['off', value]) {
				await configurationService.setUserConfiguration(KEYWORD_ACTIVIATION_SETTING_ID, nextValue);
				configurationService.onDidChangeConfigurationEmitter.fire({
					source: ConfigurationTarget.USER,
					affectedKeys: new Set([KEYWORD_ACTIVIATION_SETTING_ID]),
					change: { keys: [KEYWORD_ACTIVIATION_SETTING_ID], overrides: [] },
					affectsConfiguration: key => key === KEYWORD_ACTIVIATION_SETTING_ID
				});
			}

			contribution.dispose();
			store.add(instantiationService.createInstance(KeywordActivationContribution));
			assert.strictEqual(configurationService.onDidChangeConfigurationEmitter.hasListeners(), false);
			assert.strictEqual(registry.getConfigurationProperties()[KEYWORD_ACTIVIATION_SETTING_ID], previousSetting);
			assert.strictEqual(CommandsRegistry.getCommand('keywordActivation.status.command'), undefined);
		});
	}
});
