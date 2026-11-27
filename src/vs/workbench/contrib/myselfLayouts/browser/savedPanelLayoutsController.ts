/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { raceCancellation } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { escapeIcons } from '../../../../base/common/iconLabels.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { IWorkbenchLayoutService, isHorizontal, Parts } from '../../../services/layout/browser/layoutService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { isContainerId, layoutName, layoutStorageKey, readLayout, savedPanelLayoutPrefix, SavedPanelLayout, SavedPanelPart } from './savedPanelLayout.js';
import { SavedPanelLayoutProfileTracker } from './savedPanelLayoutProfiles.js';

export type SavedLayoutAction = 'save' | 'apply' | 'delete';

const locations = [
	{ key: 'sidebar', part: Parts.SIDEBAR_PART, location: ViewContainerLocation.Sidebar },
	{ key: 'panel', part: Parts.PANEL_PART, location: ViewContainerLocation.Panel },
	{ key: 'auxiliaryBar', part: Parts.AUXILIARYBAR_PART, location: ViewContainerLocation.AuxiliaryBar },
] as const;

type LayoutLocation = typeof locations[number];

interface LayoutRequest {
	readonly token: CancellationToken;
	isCurrent(): boolean;
}

interface LayoutPick extends IQuickPickItem {
	readonly key: string;
	readonly layout: SavedPanelLayout;
	readonly rawValue: string;
}

/** Save and apply explicit, local-profile pane snapshots. */
export class SavedPanelLayoutsController extends Disposable {
	private readonly active = this._register(new MutableDisposable<CancellationTokenSource>());

	constructor(
		private readonly layout: Pick<IWorkbenchLayoutService, 'isVisible' | 'setPartHidden' | 'getPanelPosition' | 'setPanelPosition' | 'getPanelAlignment' | 'setPanelAlignment'>,
		private readonly views: Pick<IViewsService, 'getVisibleViewContainer' | 'isViewContainerActive' | 'openViewContainer'>,
		private readonly viewDescriptors: Pick<IViewDescriptorService, 'getViewContainerById' | 'getViewContainerLocation'>,
		private readonly paneComposites: Pick<IPaneCompositePartService, 'getPaneComposite'>,
		private readonly profiles: Pick<SavedPanelLayoutProfileTracker, 'current' | 'onDidChange'>,
		private readonly storage: Pick<IStorageService, 'get' | 'keys' | 'store' | 'remove' | 'hasScope'>,
		private readonly quickInput: Pick<IQuickInputService, 'input' | 'pick'>,
		private readonly dialogs: Pick<IDialogService, 'confirm'>,
		private readonly notifications: Pick<INotificationService, 'info'>,
		private readonly trust: Pick<IWorkspaceTrustManagementService, 'workspaceTrustInitialized' | 'isWorkspaceTrusted' | 'onDidChangeTrust'>,
	) {
		super();
		this._register(this.profiles.onDidChange(() => this.active.value?.cancel()));
	}

	override dispose(): void {
		this.active.value?.cancel();
		super.dispose();
	}

	async run(action: SavedLayoutAction): Promise<void> {
		if (this._store.isDisposed || this.active.value) {
			return;
		}
		const source = new CancellationTokenSource();
		this.active.value = source;
		const profile = this.profiles.current;
		const request: LayoutRequest = {
			token: source.token,
			isCurrent: () => !source.token.isCancellationRequested
				&& this.profiles.current === profile
				&& (this.storage.hasScope(profile.profile)
					|| (profile.storageOwner !== profile.profile && this.storage.hasScope(profile.storageOwner))),
		};
		const trustListener = action === 'apply' ? this.trust.onDidChangeTrust(trusted => {
			if (!trusted) {
				source.cancel();
			}
		}) : undefined;
		try {
			if (await raceCancellation(profile.whenSettled, request.token) !== true || !request.isCurrent()) {
				return;
			}
			switch (action) {
				case 'save': return await this.save(request);
				case 'apply': return await this.apply(request);
				case 'delete': return await this.delete(request);
			}
		} finally {
			trustListener?.dispose();
			this.active.clear();
		}
	}

	private capturePart({ part, location }: LayoutLocation): SavedPanelPart {
		const visible = this.layout.isVisible(part);
		const id = visible ? this.views.getVisibleViewContainer(location)?.id : undefined;
		return isContainerId(id) ? { visible, containerId: id } : { visible };
	}

	private async save(request: LayoutRequest): Promise<void> {
		const input = await this.quickInput.input({
			title: localize('savePanelLayoutTitle', "Save Panel Layout"),
			prompt: localize('savePanelLayoutPrompt', "Enter a name for the current sidebars and panel."),
			validateInput: async value => layoutName(value) ? undefined : localize('invalidPanelLayoutName', "Enter a name of 1–64 characters without control characters."),
		}, request.token);
		const name = input === undefined ? undefined : layoutName(input);
		if (!name || !request.isCurrent()) {
			return;
		}
		const key = layoutStorageKey(name);
		const previous = this.storage.get(key, StorageScope.PROFILE);
		if (previous !== undefined) {
			const { confirmed } = await this.dialogs.confirm({
				type: 'question',
				message: localize('replacePanelLayout', "Replace the saved panel layout “{0}”?", name),
				primaryButton: localize('replacePanelLayoutButton', "Replace"),
				custom: true,
				token: request.token,
			});
			if (!confirmed || !request.isCurrent() || this.storage.get(key, StorageScope.PROFILE) !== previous) {
				return;
			}
		}
		const sidebar = this.capturePart(locations[0]);
		const panel = this.capturePart(locations[1]);
		const auxiliaryBar = this.capturePart(locations[2]);
		const snapshot: SavedPanelLayout = {
			version: 1,
			name,
			sidebar,
			panel,
			auxiliaryBar,
			panelPosition: panel.visible ? this.layout.getPanelPosition() : undefined,
			panelAlignment: panel.visible ? this.layout.getPanelAlignment() : undefined,
		};
		this.storage.store(key, JSON.stringify(snapshot), StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	private async pick(request: LayoutRequest, title: string): Promise<LayoutPick | undefined> {
		const items: LayoutPick[] = [];
		for (const key of this.storage.keys(StorageScope.PROFILE, StorageTarget.MACHINE)) {
			if (!key.startsWith(savedPanelLayoutPrefix)) {
				continue;
			}
			const rawValue = this.storage.get(key, StorageScope.PROFILE);
			const layout = readLayout(key, rawValue);
			if (layout && rawValue !== undefined) {
				items.push({ key, rawValue, layout, label: escapeIcons(layout.name) });
			}
		}
		if (!items.length) {
			this.notifications.info(localize('noSavedPanelLayouts', "Save a panel layout in the View menu first."));
			return undefined;
		}
		return this.quickInput.pick(items.sort((a, b) => a.layout.name.localeCompare(b.layout.name)), { title }, request.token);
	}

	private isCurrentPick(request: LayoutRequest, picked: LayoutPick): boolean {
		return request.isCurrent() && this.storage.get(picked.key, StorageScope.PROFILE) === picked.rawValue;
	}

	private async delete(request: LayoutRequest): Promise<void> {
		const selected = await this.pick(request, localize('deletePanelLayoutTitle', "Delete Saved Panel Layout"));
		if (!selected || !this.isCurrentPick(request, selected)) {
			return;
		}
		const { confirmed } = await this.dialogs.confirm({
			type: 'question',
			message: localize('deletePanelLayout', "Delete the saved panel layout “{0}”?", selected.layout.name),
			primaryButton: localize('deletePanelLayoutButton', "Delete"),
			custom: true,
			token: request.token,
		});
		if (confirmed && this.isCurrentPick(request, selected)) {
			this.storage.remove(selected.key, StorageScope.PROFILE);
		}
	}

	private async apply(request: LayoutRequest): Promise<void> {
		await raceCancellation(this.trust.workspaceTrustInitialized, request.token);
		if (!request.isCurrent()) {
			return;
		}
		if (!this.trust.isWorkspaceTrusted()) {
			this.notifications.info(localize('applyPanelLayoutRequiresTrust', "Trust this workspace before applying a panel layout."));
			return;
		}
		const selected = await this.pick(request, localize('applyPanelLayoutTitle', "Apply Saved Panel Layout"));
		if (!selected || !this.isCurrentPick(request, selected)) {
			return;
		}
		const canApply = () => request.isCurrent() && this.trust.isWorkspaceTrusted();
		const { layout } = selected;
		let skipped = false;
		let panelRestored = false;
		for (const location of locations) {
			if (!canApply()) {
				return;
			}
			const part = layout[location.key];
			if (!part.visible) {
				continue;
			}
			const restored = await this.restoreVisiblePart(location, part);
			skipped ||= !restored;
			if (location.key === 'panel') {
				panelRestored = restored;
			}
		}
		if (!canApply()) {
			return;
		}
		// Setting a panel position opens a hidden panel. Apply geometry only after
		// successfully restoring the requested visible panel.
		if (panelRestored && this.layout.isVisible(Parts.PANEL_PART) && layout.panelPosition !== undefined) {
			if (layout.panelPosition !== this.layout.getPanelPosition()) {
				this.layout.setPanelPosition(layout.panelPosition);
			}
			if (isHorizontal(layout.panelPosition) && layout.panelAlignment && layout.panelAlignment !== this.layout.getPanelAlignment()) {
				this.layout.setPanelAlignment(layout.panelAlignment);
			}
		}
		for (const { key, part } of locations) {
			if (canApply() && !layout[key].visible && this.layout.isVisible(part)) {
				this.layout.setPartHidden(true, part);
			}
		}
		if (skipped && canApply()) {
			this.notifications.info(localize('panelLayoutUnavailableViews', "Some panels in this layout are unavailable in this window."));
		}
	}

	private async restoreVisiblePart({ part, location }: LayoutLocation, state: SavedPanelPart): Promise<boolean> {
		const id = state.containerId;
		if (!id || (this.layout.isVisible(part) && this.views.getVisibleViewContainer(location)?.id === id)) {
			return this.layout.isVisible(part);
		}
		const container = this.viewDescriptors.getViewContainerById(id);
		if (!container || this.viewDescriptors.getViewContainerLocation(container) !== location
			|| !this.views.isViewContainerActive(id) || !this.paneComposites.getPaneComposite(id, location)) {
			return false;
		}
		try {
			return !!(await this.views.openViewContainer(id, false)) && this.layout.isVisible(part);
		} catch {
			return false;
		}
	}
}
