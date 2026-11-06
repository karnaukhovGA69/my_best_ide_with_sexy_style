/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import type { IChatUserInteractionTiming } from '../../../../../platform/otel/common/chatUserInteraction.js';
import { ChatUserInteractionOTelService } from '../../browser/chatUserInteractionOTel.js';

suite('Chat interaction OTel disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	test('does not require routing services or collect identities and counters', async () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = instantiation.createInstance(ChatUserInteractionOTelService);
		assert.deepStrictEqual(service.begin(), { rendererId: '', interactionOrdinal: 0 });
		assert.deepStrictEqual(service.begin(), { rendererId: '', interactionOrdinal: 0 });
		const data = new Proxy({} as IChatUserInteractionTiming, { get: () => { throw new Error('Timing must not be read'); } });
		for (const session of [undefined, 'local', 'remote', 'extension']) {
			service.report(data, undefined, session);
		}
		assert.deepStrictEqual(await service.flush(), { schemaVersion: 1, started: 0, completed: 0, failed: 0 });
	});
});
