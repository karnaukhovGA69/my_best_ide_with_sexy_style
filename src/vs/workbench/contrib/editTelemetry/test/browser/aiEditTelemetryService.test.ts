/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IEditTelemetryCodeAcceptedData, IEditTelemetryCodeRejectedData, IEditTelemetryCodeSuggestedData } from '../../browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { IRandomService, RandomService } from '../../browser/randomService.js';
import { AiEditTelemetryServiceImpl } from '../../browser/telemetry/aiEditTelemetry/aiEditTelemetryServiceImpl.js';

suite('Disabled AI edit telemetry', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('needs no telemetry, data channel, or random service', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		assert.ok(instantiation.createInstance(AiEditTelemetryServiceImpl));
	});

	test('retains unique serializable edit identities for API consumers', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = instantiation.createInstance(AiEditTelemetryServiceImpl);
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			const id = service.createSuggestionId(upcastPartial<IEditTelemetryCodeSuggestedData>({}));
			const serialized = JSON.stringify(id);
			assert.match(serialized, /^"sgt-[0-9a-f-]+"$/);
			ids.add(serialized);
		}
		assert.strictEqual(ids.size, 100);
	});

	test('does not read, enumerate or mutate analytics payloads', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.stub(IRandomService, new RandomService());
		const service = instantiation.createInstance(AiEditTelemetryServiceImpl);
		const forbidden = () => { throw new Error('Analytics payload must not be inspected'); };
		const payload = new Proxy(Object.freeze({}), { get: forbidden, ownKeys: forbidden, set: forbidden });
		assert.doesNotThrow(() => {
			service.createSuggestionId(upcastPartial<IEditTelemetryCodeSuggestedData>(payload));
			service.handleCodeAccepted(upcastPartial<IEditTelemetryCodeAcceptedData>(payload));
			service.handleCodeRejected(upcastPartial<IEditTelemetryCodeRejectedData>(payload));
		});
	});
});
