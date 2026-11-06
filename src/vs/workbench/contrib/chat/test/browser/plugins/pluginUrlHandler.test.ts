/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { PluginUrlHandler } from '../../../browser/pluginUrlHandler.js';

suite('PluginUrlHandler disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register a URL handler or activate services for plugin links', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const handler = store.add(instantiation.createInstance(PluginUrlHandler));
		const unreadable = new Proxy({} as URI, { get() { throw new Error('Plugin URL must not be inspected'); } });
		for (const uri of [
			URI.parse('vscode://chat-plugin/install?source=example/plugins&plugin=test'),
			URI.parse('vscode://chat-plugin/add-marketplace?ref=example/plugins'),
			URI.parse('vscode://unrelated/open'),
			unreadable,
		]) {
			assert.strictEqual(await handler.handleURL(uri), false);
		}
	});
});
