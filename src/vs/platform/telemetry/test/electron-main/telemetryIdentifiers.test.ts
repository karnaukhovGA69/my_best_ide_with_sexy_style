/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../log/common/log.js';
import { IStateService } from '../../../state/node/state.js';
import { resolveMachineId, resolveSqmId, resolveDevDeviceId } from '../../node/telemetryUtils.js';
import { resolveMachineId as resolveElectronMachineId, resolveSqmId as resolveElectronSqmId, resolveDevDeviceId as resolveElectronDevDeviceId, validateDevDeviceId } from '../../electron-main/telemetryUtils.js';

suite('Telemetry identifiers', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('product opt-out never reads or writes persisted identifiers', async () => {
		const unexpectedAccess = (): never => { throw new Error('Telemetry identifier state must not be accessed'); };
		const stateService: IStateService = {
			_serviceBrand: undefined,
			getItem: unexpectedAccess,
			setItem: unexpectedAccess,
			setItems: unexpectedAccess,
			removeItem: unexpectedAccess,
			close: unexpectedAccess,
		};
		const logService = new NullLogService();
		const productService = { enableTelemetry: false };
		const ids = await Promise.all([
			resolveMachineId(stateService, logService, productService),
			resolveSqmId(stateService, logService, productService),
			resolveDevDeviceId(stateService, logService, productService),
			resolveElectronMachineId(stateService, logService, productService),
			resolveElectronSqmId(stateService, logService, productService),
			resolveElectronDevDeviceId(stateService, logService, productService),
		]);
		await validateDevDeviceId(stateService, logService, productService);
		assert.deepStrictEqual(ids, ['', '', '', '', '', '']);
	});
});
