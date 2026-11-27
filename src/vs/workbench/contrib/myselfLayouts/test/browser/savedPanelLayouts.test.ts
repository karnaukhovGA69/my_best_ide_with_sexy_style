/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfirmationResult } from '../../../../../platform/dialogs/common/dialogs.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { InMemoryStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IUserDataProfile, toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { IAnyWorkspaceIdentifier } from '../../../../../platform/workspace/common/workspace.js';
import type { PaneCompositeDescriptor } from '../../../../browser/panecomposite.js';
import { IPaneComposite } from '../../../../common/panecomposite.js';
import { ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { PanelAlignment, Parts, Position } from '../../../../services/layout/browser/layoutService.js';
import { UserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfileService.js';
import { layoutStorageKey, readLayout, SavedPanelLayout } from '../../browser/savedPanelLayout.js';
import { SavedPanelLayoutsController } from '../../browser/savedPanelLayoutsController.js';

suite('Saved panel layouts', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const profilesHome = URI.file('/profiles');
	const firstProfile = toUserDataProfile('first', 'First', URI.joinPath(profilesHome, 'first'), profilesHome);
	const secondProfile = toUserDataProfile('second', 'Second', URI.joinPath(profilesHome, 'second'), profilesHome);
	const localProfile = StorageScope.PROFILE;
	const machine = StorageTarget.MACHINE;
	const key = layoutStorageKey('Work');

	function snapshot(): SavedPanelLayout {
		return {
			version: 1,
			name: 'Work',
			sidebar: { visible: true, containerId: 'files' },
			panel: { visible: true, containerId: 'problems' },
			auxiliaryBar: { visible: false },
			panelPosition: Position.TOP,
			panelAlignment: 'left',
		};
	}

	function fixture() {
		const profiles = disposables.add(new UserDataProfileService(firstProfile));
		const trust = disposables.add(new Emitter<boolean>());
		const visible = new Set<Parts>([Parts.SIDEBAR_PART, Parts.PANEL_PART, Parts.AUXILIARYBAR_PART]);
		const parts = [Parts.SIDEBAR_PART, Parts.PANEL_PART, Parts.AUXILIARYBAR_PART] as const;
		const active = new Map<ViewContainerLocation, string>([
			[ViewContainerLocation.Sidebar, 'git'],
			[ViewContainerLocation.Panel, 'terminal'],
			[ViewContainerLocation.AuxiliaryBar, 'docs'],
		]);
		const containers = new Map<string, ViewContainerLocation>([
			['files', ViewContainerLocation.Sidebar], ['git', ViewContainerLocation.Sidebar],
			['problems', ViewContainerLocation.Panel], ['terminal', ViewContainerLocation.Panel],
			['docs', ViewContainerLocation.AuxiliaryBar],
		]);
		const opened: string[] = [];
		const hidden: Parts[] = [];
		const positions: Position[] = [];
		const alignments: PanelAlignment[] = [];
		const notifications: string[] = [];
		const state = {
			trusted: true,
			input: async (): Promise<string | undefined> => 'Work',
			pick: async (items: readonly IQuickPickItem[], _token?: CancellationToken): Promise<IQuickPickItem | undefined> => items[0],
			confirm: async (): Promise<IConfirmationResult> => ({ confirmed: false }),
			position: Position.BOTTOM,
			alignment: 'center' as PanelAlignment,
			storageProfile: firstProfile.id,
		};
		const storage = disposables.add(new class extends InMemoryStorageService {
			override hasScope(profile: IUserDataProfile | IAnyWorkspaceIdentifier): boolean {
				return state.storageProfile === profile.id;
			}
		});
		const controller = disposables.add(new SavedPanelLayoutsController(
			{
				isVisible: part => visible.has(part),
				setPartHidden: (hide, part) => {
					assert.ok(hide, 'The controller must never open an implicit fallback panel');
					visible.delete(part);
					hidden.push(part);
				},
				getPanelPosition: () => state.position,
				setPanelPosition: position => {
					assert.ok(visible.has(Parts.PANEL_PART), 'Moving a hidden panel opens a fallback panel');
					state.position = position;
					positions.push(position);
				},
				getPanelAlignment: () => state.alignment,
				setPanelAlignment: alignment => {
					state.alignment = alignment;
					alignments.push(alignment);
				},
			},
			{
				getVisibleViewContainer: location => active.has(location) ? { id: active.get(location)! } as ViewContainer : null,
				isViewContainerActive: id => containers.has(id),
				openViewContainer: async (id, focus) => {
					assert.strictEqual(focus, false);
					const location = containers.get(id)!;
					opened.push(id);
					active.set(location, id);
					visible.add(parts[location]);
					return {} as IPaneComposite;
				},
			},
			{
				getViewContainerById: id => containers.has(id) ? { id } as ViewContainer : null,
				getViewContainerLocation: container => containers.get(container.id) ?? null,
			},
			{ getPaneComposite: (id, location) => containers.get(id) === location ? {} as PaneCompositeDescriptor : undefined },
			profiles, storage,
			{
				input: () => state.input(),
				pick: ((items: readonly IQuickPickItem[], _options?: object, token?: CancellationToken) => state.pick(items, token)) as IQuickInputService['pick'],
			},
			{ confirm: () => state.confirm() },
			{ info: message => { notifications.push(String(message)); } },
			{ workspaceTrustInitialized: Promise.resolve(), isWorkspaceTrusted: () => state.trusted, onDidChangeTrust: trust.event },
		));
		const storeSnapshot = (value = snapshot()) => storage.store(key, JSON.stringify(value), localProfile, machine);
		const readSnapshot = () => readLayout(key, storage.get(key, localProfile));
		return { controller, state, storage, visible, containers, hidden, opened, positions, alignments, profiles, trust, notifications, storeSnapshot, readSnapshot };
	}

	test('saving is explicit and stores one named profile machine record', async () => {
		const f = fixture();
		f.storage.store('other.setting', 'keep', localProfile, StorageTarget.USER);
		assert.deepStrictEqual(f.storage.keys(localProfile, machine), []);
		f.visible.delete(Parts.PANEL_PART);
		f.state.input = async () => '  Work  ';
		await f.controller.run('save');
		assert.deepStrictEqual(f.storage.keys(localProfile, machine), [key]);
		assert.deepStrictEqual(f.readSnapshot(), {
			version: 1, name: 'Work', sidebar: { visible: true, containerId: 'git' },
			panel: { visible: false }, auxiliaryBar: { visible: true, containerId: 'docs' },
		});
		assert.strictEqual(f.storage.get('other.setting', localProfile), 'keep');
		assert.deepStrictEqual(f.opened, []);
	});

	test('a cancelled or invalid name does not create a record', async () => {
		const f = fixture();
		for (const value of [undefined, '   ', 'bad\u202Ename', 'x'.repeat(65)]) {
			f.state.input = async () => value;
			await f.controller.run('save');
		}
		assert.deepStrictEqual(f.storage.keys(localProfile, machine), []);
	});

	test('replacement and deletion require confirmation and preserve unrelated presets', async () => {
		const f = fixture();
		f.storeSnapshot();
		const other = layoutStorageKey('Other');
		f.storage.store(other, JSON.stringify({ ...snapshot(), name: 'Other' }), localProfile, machine);
		f.state.input = async () => 'WORK';
		await f.controller.run('save');
		assert.deepStrictEqual(f.readSnapshot(), snapshot());
		f.state.confirm = async () => ({ confirmed: true });
		await f.controller.run('save');
		assert.strictEqual(f.readSnapshot()?.name, 'WORK');
		f.state.pick = async items => items.find(item => item.label === 'WORK');
		f.state.confirm = async () => ({ confirmed: false });
		await f.controller.run('delete');
		assert.ok(f.readSnapshot());
		f.state.confirm = async () => ({ confirmed: true });
		await f.controller.run('delete');
		assert.deepStrictEqual(f.storage.keys(localProfile, machine), [other]);
	});

	test('applying a chosen preset restores the exact available views and geometry', async () => {
		const f = fixture();
		f.storeSnapshot();
		f.visible.delete(Parts.PANEL_PART);
		f.state.pick = async () => undefined;
		await f.controller.run('apply');
		assert.deepStrictEqual(f.opened, []);
		assert.deepStrictEqual(f.positions, []);
		f.state.pick = async items => items[0];
		await f.controller.run('apply');
		assert.deepStrictEqual(f.opened, ['files', 'problems']);
		assert.deepStrictEqual(f.positions, [Position.TOP]);
		assert.deepStrictEqual(f.alignments, ['left']);
		assert.deepStrictEqual(f.hidden, [Parts.AUXILIARYBAR_PART]);
		assert.deepStrictEqual(f.readSnapshot(), snapshot());
	});

	test('vertical panel snapshots do not apply horizontal alignment', async () => {
		const f = fixture();
		f.storeSnapshot({ ...snapshot(), panelPosition: Position.RIGHT });
		await f.controller.run('apply');
		assert.deepStrictEqual(f.positions, [Position.RIGHT]);
		assert.deepStrictEqual(f.alignments, []);
	});

	test('missing or relocated view containers do not open a fallback or move the panel', async () => {
		const f = fixture();
		f.storeSnapshot();
		f.containers.delete('files');
		f.containers.set('problems', ViewContainerLocation.AuxiliaryBar);
		f.visible.delete(Parts.PANEL_PART);
		await f.controller.run('apply');
		assert.deepStrictEqual(f.opened, []);
		assert.deepStrictEqual(f.positions, []);
		assert.deepStrictEqual(f.hidden, [Parts.AUXILIARYBAR_PART]);
		assert.match(f.notifications.join(' '), /unavailable/);
	});

	test('malformed layouts and unrelated storage keys cannot drive the UI', async () => {
		const f = fixture();
		const wrongKey = layoutStorageKey('Somewhere else');
		f.storage.store(wrongKey, JSON.stringify(snapshot()), localProfile, machine);
		f.storage.store(key, JSON.stringify({ ...snapshot(), panelPosition: 42 }), localProfile, machine);
		f.storage.store(layoutStorageKey('Unreadable'), '{', localProfile, machine);
		f.state.pick = async () => { throw new Error('Nothing valid can be picked'); };
		await f.controller.run('apply');
		assert.deepStrictEqual(f.opened, []);
		assert.deepStrictEqual(f.positions, []);
		assert.match(f.notifications.join(' '), /Save a panel layout/);
	});

	test('Restricted Mode and trust loss prevent opening any views', async () => {
		const f = fixture();
		f.storeSnapshot();
		f.state.trusted = false;
		f.state.pick = async () => { throw new Error('Restricted Mode should not reach the picker'); };
		await f.controller.run('apply');
		assert.match(f.notifications.join(' '), /Trust this workspace/);
		f.state.trusted = true;
		f.state.pick = async (items, token) => {
			f.state.trusted = false;
			f.trust.fire(false);
			assert.ok(token?.isCancellationRequested);
			return items[0];
		};
		await f.controller.run('apply');
		assert.deepStrictEqual(f.opened, []);
		assert.deepStrictEqual(f.hidden, []);
	});

	test('a profile change while naming a preset cannot write to the next profile', async () => {
		const f = fixture();
		const editing = new DeferredPromise<void>();
		const name = new DeferredPromise<string>();
		f.state.input = () => {
			void editing.complete();
			return name.p;
		};
		const operation = f.controller.run('save');
		await editing.p;
		await f.profiles.updateCurrentProfile(secondProfile);
		f.state.storageProfile = secondProfile.id;
		await name.complete('Work');
		await operation;
		assert.deepStrictEqual(f.storage.keys(localProfile, machine), []);
	});

	test('a settled switch to a profile sharing default global state can save on that storage', async () => {
		const f = fixture();
		await f.profiles.updateCurrentProfile({ ...secondProfile, useDefaultFlags: { globalState: true } });
		assert.notStrictEqual(f.state.storageProfile, f.profiles.currentProfile.id);
		await f.controller.run('save');
		assert.strictEqual(f.readSnapshot()?.name, 'Work');
	});

	test('replacing a record changed during confirmation keeps the newer record', async () => {
		const f = fixture();
		f.storeSnapshot();
		const replacement = { ...snapshot(), panelPosition: Position.RIGHT };
		f.state.confirm = async () => {
			f.storeSnapshot(replacement);
			return { confirmed: true };
		};
		await f.controller.run('save');
		assert.deepStrictEqual(f.readSnapshot(), replacement);
	});
});
