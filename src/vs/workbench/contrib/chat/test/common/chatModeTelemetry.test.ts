/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import type { IChatMode } from '../../common/chatModes.js';
import { reportChatModeChange } from '../../common/chatModeTelemetry.js';

suite('Chat mode telemetry disabled', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('does not read mode metadata or call telemetry', () => {
		const fail = () => { throw new Error('Analytics dependencies must not be read'); };
		const mode = new Proxy({} as IChatMode, { get: fail });
		const telemetry = new Proxy({} as ITelemetryService, { get: fail });
		assert.strictEqual(reportChatModeChange(telemetry, mode, mode, 7, 'provider'), undefined);
	});
});
