/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { ChatEditorTopologyTelemetry } from '../../../browser/telemetry/chatEditorTopologyTelemetry.js';
import { ChatModelCountTelemetry } from '../../../browser/telemetry/chatModelCountTelemetry.js';

suite('Chat topology and model analytics disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	for (const ctor of [ChatEditorTopologyTelemetry, ChatModelCountTelemetry]) {
		test(`${ctor.ID} does not request chat, editor, environment or telemetry services`, () => {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			store.add(instantiation.createInstance(ctor));
		});
	}
});
