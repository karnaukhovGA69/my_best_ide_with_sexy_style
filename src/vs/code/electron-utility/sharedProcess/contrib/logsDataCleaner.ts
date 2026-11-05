/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '../../../../base/common/async.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { pruneDiagnosticLogSessions } from '../../../../platform/log/node/diagnosticLogSessionRetention.js';

export class LogsDataCleaner extends Disposable {

	constructor(
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		const scheduler = this._register(new RunOnceScheduler(() => {
			this.cleanUpOldLogs();
		}, 10 * 1000 /* after 10s */));
		scheduler.schedule();
	}

	private async cleanUpOldLogs(): Promise<void> {
		this.logService.trace('[logs cleanup]: Starting to clean up old logs.');

		try {
			const result = await pruneDiagnosticLogSessions(this.environmentService.logsHome.fsPath);
			this.logService.trace(`[logs cleanup]: Removed ${result.removed.length} archived sessions; preserved ${result.preserved.length} active or unscannable sessions; observed ${result.remainingBytes} bytes remaining.`);
		} catch (error) {
			onUnexpectedError(error);
		}
	}
}
