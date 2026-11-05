/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import { DisablementReason, IUpdateService, IQuitAndInstallOptions, State } from './update.js';

/** Compatibility service: no updater, provider, timers, network or restart hooks. */
export class DisabledUpdateService extends Disposable implements IUpdateService {
	declare readonly _serviceBrand: undefined;
	readonly onStateChange = Event.None;
	readonly state = Object.freeze(State.Disabled(DisablementReason.DisabledByEnvironment));

	async checkForUpdates(_explicit: boolean): Promise<void> { this.unavailable(); }
	async downloadUpdate(_explicit: boolean): Promise<void> { this.unavailable(); }
	async applyUpdate(): Promise<void> { this.unavailable(); }
	async quitAndInstall(_options?: IQuitAndInstallOptions): Promise<void> { this.unavailable(); }
	async _applySpecificUpdate(_packagePath: string): Promise<void> { this.unavailable(); }
	async isLatestVersion(): Promise<undefined> { return undefined; }
	async setInternalOrg(_internalOrg: string | undefined): Promise<void> { }

	private unavailable(): never {
		throw new Error(localize('updatesUnavailable', "Built-in IDE updates are unavailable in Myself IDE."));
	}
}
