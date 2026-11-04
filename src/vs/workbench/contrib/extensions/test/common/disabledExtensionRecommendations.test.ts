/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionTipsChannel } from '../../../../../platform/extensionManagement/common/extensionManagementIpc.js';
import { NullExtensionTipsService } from '../../../../../platform/extensionManagement/common/nullExtensionTipsService.js';
import { NullExtensionRecommendationNotificationService, RecommendationsNotificationResult, RecommendationSource } from '../../../../../platform/extensionRecommendations/common/extensionRecommendations.js';
import { ExtensionRecommendationNotificationServiceChannel } from '../../../../../platform/extensionRecommendations/common/extensionRecommendationsIpc.js';
import { NullExtensionRecommendationsService } from '../../../../services/extensionRecommendations/common/extensionRecommendations.js';

suite('Disabled extension recommendations', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps recommendation consumers usable without discovery services', async () => {
		const service = new NullExtensionRecommendationsService();
		assert.deepStrictEqual(await Promise.all([
			service.getImportantRecommendations(), service.getOtherRecommendations(),
			service.getWorkspaceRecommendations(), service.getExeBasedRecommendations(),
			service.getConfigBasedRecommendations(),
		]), [[], [], [], { important: [], others: [] }, { important: [], others: [] }]);
		assert.deepStrictEqual({
			all: service.getAllRecommendationsWithReason(), files: service.getFileBasedRecommendations(),
			keymaps: service.getKeymapRecommendations(), languages: service.getLanguageRecommendations(),
			remote: service.getRemoteRecommendations(),
		}, { all: {}, files: [], keymaps: [], languages: [], remote: [] });
	});

	test('shared process tips IPC remains available without filesystem or executable scans', async () => {
		const channel = new ExtensionTipsChannel(new NullExtensionTipsService());
		assert.deepStrictEqual(await Promise.all([
			channel.call(undefined, 'getConfigBasedTips', [URI.file('/missing-project').toJSON()]),
			channel.call(undefined, 'getImportantExecutableBasedTips'),
			channel.call(undefined, 'getOtherExecutableBasedTips'),
		]), [[], [], []]);
	});

	test('legacy notification requests are ignored across IPC', async () => {
		const service = new NullExtensionRecommendationNotificationService();
		const channel = new ExtensionRecommendationNotificationServiceChannel(service);
		const result = await channel.call(undefined, 'promptImportantExtensionsInstallNotification', [{
			source: RecommendationSource.EXE, extensions: ['example.extension'], name: 'Example',
		}]);
		assert.deepStrictEqual({ ignore: service.hasToIgnoreRecommendationNotifications(), result }, {
			ignore: true, result: RecommendationsNotificationResult.Ignored,
		});
		await service.promptWorkspaceRecommendations();
	});
});
