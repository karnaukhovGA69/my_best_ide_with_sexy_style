/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isProfileUsingDefaultStorage } from '../../../../platform/storage/common/storage.js';
import type { IUserDataProfile } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';

interface PanelLayoutProfile {
	readonly profile: IUserDataProfile;
	readonly storageOwner: IUserDataProfile;
	readonly whenSettled: Promise<boolean>;
}

/** Tracks the storage identity retained across switches that share default global state. */
export class SavedPanelLayoutProfileTracker extends Disposable {
	static readonly ID = 'workbench.contrib.myselfSavedPanelLayoutProfiles';
	readonly onDidChange: IUserDataProfileService['onDidChangeCurrentProfile'];
	private snapshot: PanelLayoutProfile;

	constructor(@IUserDataProfileService profiles: IUserDataProfileService) {
		super();
		const profile = profiles.currentProfile;
		this.snapshot = { profile, storageOwner: profile, whenSettled: Promise.resolve(true) };
		this.onDidChange = profiles.onDidChangeCurrentProfile;
		this._register(this.onDidChange(event => {
			const previous = this.snapshot;
			const settled = event.whenSettled ?? Promise.resolve(true);
			// RemoteStorageService keeps the original identity when both sides
			// use the default global state. An earlier switch may still be opening it.
			const keepsStorage = event.whenSettled !== undefined && previous.profile === event.previous
				&& isProfileUsingDefaultStorage(event.previous) && isProfileUsingDefaultStorage(event.profile)
				&& isProfileUsingDefaultStorage(previous.storageOwner);
			this.snapshot = {
				profile: event.profile,
				storageOwner: keepsStorage ? previous.storageOwner : event.profile,
				whenSettled: keepsStorage ? Promise.all([previous.whenSettled, settled]).then(([before, after]) => before && after) : settled,
			};
		}));
	}

	get current(): PanelLayoutProfile {
		return this.snapshot;
	}
}
