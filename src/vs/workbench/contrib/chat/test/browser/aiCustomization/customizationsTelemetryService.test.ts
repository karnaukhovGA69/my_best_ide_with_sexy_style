/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { URI } from '../../../../../../base/common/uri.js';
import { InstantiationService } from '../../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { CustomizationsTelemetryService, CustomizationsTelemetryContribution } from '../../../browser/aiCustomization/customizationsTelemetryService.js';

suite('Customization counting disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	test('service does not request providers or inspect sessions', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = instantiation.createInstance(CustomizationsTelemetryService);
		const uri = new Proxy({} as URI, { get: () => { throw new Error('Session must not be read'); } });
		service.reportNewSession(uri);
		service.reportNewSession(uri);
	});
	test('contribution does not observe chat sessions or completions', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		store.add(instantiation.createInstance(CustomizationsTelemetryContribution));
	});
});
