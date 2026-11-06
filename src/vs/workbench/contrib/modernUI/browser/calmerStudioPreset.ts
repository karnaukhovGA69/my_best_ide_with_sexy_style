/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ConfigurationTarget, IConfigurationService, isConfigured } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { LayoutSettings } from '../../../services/layout/browser/layoutService.js';

export const CALMER_STUDIO_SETTING = 'workbench.calmerStudio';
export const CALMER_PRESET_MARKER = 'myself.appearance.calmerPresetInitialized';
const preset = [
	['workbench.colorTheme', 'Nerded Calm'],
	['workbench.iconTheme', 'nerded-calm-file-icons'],
	[LayoutSettings.MODERN_UI, false],
	[CALMER_STUDIO_SETTING, true],
] as const;

function hasChoice(configuration: IConfigurationService, key: string): boolean {
	const value = configuration.inspect(key);
	return isConfigured(value) || value.policyValue !== undefined || value.memoryValue !== undefined;
}

/** Explicit user action: retain normal target resolution and all unrelated customizations. */
export async function applyCalmerStudioPreset(configuration: IConfigurationService): Promise<void> {
	for (const [key, value] of preset) {
		await configuration.updateValue(key, value);
	}
}

/** Existing or customized profiles never receive automatic setting writes. */
export async function initializeCalmerStudioPreset(
	configuration: IConfigurationService,
	storage: Pick<IStorageService, 'isNew' | 'getBoolean' | 'store'>,
	cancelled: () => boolean = () => false,
): Promise<boolean> {
	if (cancelled() || !storage.isNew(StorageScope.PROFILE) || storage.getBoolean(CALMER_PRESET_MARKER, StorageScope.PROFILE, false)
		|| preset.some(([key]) => hasChoice(configuration, key))) { return false; }
	for (const [key, value] of preset) {
		// Recheck after each async write so a new user choice is never overwritten.
		if (cancelled() || hasChoice(configuration, key)) { return false; }
		await configuration.updateValue(key, value, ConfigurationTarget.USER_LOCAL);
	}
	if (cancelled()) { return false; }
	storage.store(CALMER_PRESET_MARKER, true, StorageScope.PROFILE, StorageTarget.MACHINE);
	return true;
}

class CalmerStudioPresetContribution extends Disposable {
	static readonly ID = 'workbench.contrib.calmerStudioPreset';
	constructor(
		@IConfigurationService configuration: IConfigurationService,
		@IStorageService storage: IStorageService,
		@ILogService log: ILogService,
	) {
		super();
		void initializeCalmerStudioPreset(configuration, storage, () => this._store.isDisposed).catch(error => log.error('Unable to initialize Calmer Studio preset', error));
	}
}

registerWorkbenchContribution2(CalmerStudioPresetContribution.ID, CalmerStudioPresetContribution, WorkbenchPhase.AfterRestored);
