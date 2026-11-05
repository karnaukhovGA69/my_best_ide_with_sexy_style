/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { timeout } from '../../../../../base/common/async.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { Extensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IAssignmentFilter, IWorkbenchAssignmentService, WorkbenchAssignmentService } from '../../common/assignmentService.js';

suite('Disabled workbench experiments', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): WorkbenchAssignmentService {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		return store.add(instantiation.createInstance(WorkbenchAssignmentService));
	}

	test('registered singleton needs no network, storage, account or telemetry services', () => {
		const descriptor = getSingletonServiceDescriptors().find(([id]) => id === IWorkbenchAssignmentService)?.[1];
		assert.ok(descriptor);
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		const service = instantiation.createInstance(descriptor);
		assert.ok(service instanceof WorkbenchAssignmentService);
		store.add(service);
	});

	test('returns no remote assignments through either API', async () => {
		const service = createService();
		for (const name of ['', 'config.editor.test', '/vscode/config.editor.test']) {
			assert.strictEqual(await service.getTreatment(name), undefined);
			const result = await service.getTreatmentWithAssignment(name);
			assert.strictEqual(result.value, undefined);
			assert.strictEqual(await result.hasAssignment, false);
		}
		assert.deepStrictEqual(await service.getCurrentExperiments(), []);
	});

	test('ignores legacy opt-in and developer overrides without scheduling their delay', async () => {
		const instantiation = store.add(new TestInstantiationService(undefined, true));
		instantiation.stub(IConfigurationService, new TestConfigurationService({ workbench: { enableExperiments: true }, experiments: { overrideDelay: 60000, override: { test: true } } }));
		const service = store.add(instantiation.createInstance(WorkbenchAssignmentService));
		assert.strictEqual(await service.getTreatment('test'), undefined);
		assert.strictEqual((await service.getTreatmentWithAssignment('test')).value, undefined);
	});

	test('does not inspect or subscribe to filters', () => {
		const service = createService();
		const forbidden = () => { throw new Error('Must not inspect a filter'); };
		const filter = upcastPartial<IAssignmentFilter>(new Proxy({}, { get: forbidden, ownKeys: forbidden }));
		assert.doesNotThrow(() => service.addTelemetryAssignmentFilter(filter));
	});

	test('emits no refresh events and remains inert after disposal', async () => runWithFakedTimers({}, async () => {
		const service = createService();
		let events = 0;
		assert.strictEqual(service.onDidRefetchAssignments, Event.None);
		store.add(service.onDidRefetchAssignments(() => { events++; }));
		service.dispose();
		await timeout(60000);
		assert.strictEqual(events, 0);
		assert.strictEqual(await service.getTreatment('test'), undefined);
		assert.strictEqual(await (await service.getTreatmentWithAssignment('test')).hasAssignment, false);
	}));

	test('does not expose an experiments opt-in setting', () => {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		assert.strictEqual(properties['workbench.enableExperiments'], undefined);
	});
});
