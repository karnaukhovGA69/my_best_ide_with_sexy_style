/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { StateType } from '../../../../platform/update/common/update.js';
import { RawContextKey, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { MenuRegistry, MenuId } from '../../../../platform/actions/common/actions.js';
import { ReleaseNotesManager } from './releaseNotesEditor.js';

export const CONTEXT_UPDATE_STATE = new RawContextKey<string>('updateState', StateType.Uninitialized);
export const MAJOR_MINOR_UPDATE_AVAILABLE = new RawContextKey<boolean>('majorMinorUpdateAvailable', false);

let releaseNotesManager: ReleaseNotesManager | undefined = undefined;

export function showReleaseNotesInEditor(instantiationService: IInstantiationService, version: string, useCurrentFile: boolean) {
	if (!releaseNotesManager) {
		releaseNotesManager = instantiationService.createInstance(ReleaseNotesManager);
	}

	return releaseNotesManager.show(version, useCurrentFile);
}

/**
 * Appends update-related menu items to the given menu. This registers menu items
 * for all update states (idle, checking, downloading, etc.) that show the current
 * update status. The underlying commands (`update.check`, `update.restart`, etc.)
 * must be registered separately.
 */
export function appendUpdateMenuItems(menuId: MenuId, group: string): void {
	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.check',
			title: nls.localize('checkForUpdates', "Check for Updates...")
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Idle)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.checking',
			title: nls.localize('checkingForUpdates2', "Checking for Updates..."),
			precondition: ContextKeyExpr.false()
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.CheckingForUpdates)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.downloadNow',
			title: nls.localize('download update_1', "Download Update (1)")
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.AvailableForDownload)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.downloading',
			title: nls.localize('DownloadingUpdate', "Downloading Update..."),
			precondition: ContextKeyExpr.false()
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloading)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.install',
			title: nls.localize('installUpdate...', "Install Update... (1)")
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloaded)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.updating',
			title: nls.localize('installingUpdate', "Installing Update..."),
			precondition: ContextKeyExpr.false()
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Updating)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		command: {
			id: 'update.cancelling',
			title: nls.localize('cancellingUpdateMenuEntry', "Cancelling Update..."),
			precondition: ContextKeyExpr.false()
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Cancelling)
	});

	MenuRegistry.appendMenuItem(menuId, {
		group,
		order: 2,
		command: {
			id: 'update.restart',
			title: nls.localize('restartToUpdate', "Restart to Update (1)")
		},
		when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Ready)
	});
}
