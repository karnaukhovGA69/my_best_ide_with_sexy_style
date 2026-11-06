/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../instantiation/test/common/instantiationServiceMock.js';
import { ITelemetryService, TelemetryLevel } from '../../../telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../telemetry/common/telemetryUtils.js';
import { DataChannelForwardingTelemetryService, forwardToChannelIf } from '../../browser/forwardingTelemetryService.js';
import { IDataChannelService } from '../../common/dataChannel.js';

suite('Disabled editor telemetry forwarding', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('can be constructed with no telemetry or data channel services', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = instantiation.createInstance(DataChannelForwardingTelemetryService);
		assert.strictEqual(service.telemetryLevel, TelemetryLevel.NONE);
		assert.strictEqual(service.sendErrorTelemetry, false);
	});

	for (const forward of [undefined, false, true]) {
		test(`never forwards events even with enabled services and marker ${forward}`, () => {
			const instantiation = store.add(new TestInstantiationService(undefined, true));
			const calls: string[] = [];
			instantiation.stub(ITelemetryService, {
				...NullTelemetryService,
				telemetryLevel: TelemetryLevel.USAGE,
				sendErrorTelemetry: true,
				publicLog: () => { calls.push('publicLog'); },
				publicLog2: () => { calls.push('publicLog2'); },
				publicLogError: () => { calls.push('publicLogError'); },
				publicLogError2: () => { calls.push('publicLogError2'); },
				setExperimentProperty: () => { calls.push('experiment'); },
				setCommonProperty: () => { calls.push('common'); }
			});
			instantiation.stub(IDataChannelService, {
				onDidSendData: Event.None,
				getDataChannel: () => {
					calls.push('channel');
					return { sendData: () => { calls.push('send'); } };
				}
			});
			const service = instantiation.createInstance(DataChannelForwardingTelemetryService);
			const data = forward === undefined ? {} : forwardToChannelIf(forward);
			service.publicLog('test', data);
			service.publicLog2('test');
			service.publicLogError('test', data);
			service.publicLogError2('test');
			service.setExperimentProperty('test', 'value');
			service.setCommonProperty('test', true);
			service.setCommonProperty('test', undefined);
			assert.deepStrictEqual(calls, []);
		});
	}

	test('does not expose identifiers from an underlying telemetry service', () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.stub(ITelemetryService, { ...NullTelemetryService, sessionId: 'fixture-session', machineId: 'fixture-machine', sqmId: 'fixture-sqm', devDeviceId: 'fixture-device', firstSessionDate: 'fixture-date', msftInternal: true });
		instantiation.stub(IDataChannelService, { getDataChannel: () => { throw new Error('Must not acquire a channel'); } });
		const service = instantiation.createInstance(DataChannelForwardingTelemetryService);
		assert.deepStrictEqual([service.sessionId, service.machineId, service.sqmId, service.devDeviceId, service.firstSessionDate], ['', '', '', '', '']);
		assert.strictEqual(service.msftInternal, undefined);
	});
});
