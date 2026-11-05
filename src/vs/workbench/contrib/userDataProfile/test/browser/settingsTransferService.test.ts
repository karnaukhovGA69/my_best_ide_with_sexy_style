/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelContentProvider, ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { MenuId, MenuRegistry, isIMenuItem } from '../../../../../platform/actions/common/actions.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { ITextDiffEditorPane, isResourceDiffEditorInput } from '../../../../common/editor.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { SettingsTransferService, settingsPreviewScheme } from '../../browser/settingsTransferService.js';
import '../../browser/settingsTransfer.contribution.js';

suite('Local settings transfer workflow', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const original = '{ // preserve\n"fixture.fontSize":12,"fixture.keep":true,"fixture.apiKey":"local-fixture"\n}';
	const incoming = URI.file('/incoming.json');
	const exported = URI.file('/exported.json');

	setup(() => {
		const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		const config: IConfigurationNode = { id: 'settings-transfer-fixture', properties: {
			'fixture.fontSize': { type: 'number' }, 'fixture.keep': { type: 'boolean' }, 'fixture.apiKey': { type: 'string' },
			'fixture.machine': { type: 'string', scope: ConfigurationScope.MACHINE }, 'fixture.restricted': { type: 'string', restricted: true },
		} };
		registry.registerConfiguration(config);
		store.add(toDisposable(() => registry.deregisterConfigurations([config])));
	});

	async function fixture(text = '{"fixture.fontSize":16}', missing = false) {
		let profile = toUserDataProfile('fixture', 'Fixture', URI.file('/profile'), URI.file('/cache'));
		const settings = profile.settingsResource;
		const files = store.add(new FileService(store.add(new NullLogService())));
		const provider = store.add(new InMemoryFileSystemProvider());
		store.add(files.registerProvider('file', provider));
		await files.createFolder(URI.file('/profile'));
		if (!missing) { await files.writeFile(settings, VSBuffer.fromString(original)); }
		await files.writeFile(incoming, VSBuffer.fromString(text));
		const state = { dirty: false, selected: [incoming] as URI[] | undefined, destination: exported as URI | undefined, after: undefined as URI | undefined, opens: 0, closes: 0, refuseEditor: false };
		const messages: string[] = [];
		const providers = new Map<string, ITextModelContentProvider>();
		const models = new Map<string, ITextModel>();
		let select = async () => state.selected;
		let save = async () => state.destination;
		const service = store.add(new SettingsTransferService(files,
			upcastPartial<IFileDialogService>({ showOpenDialog: () => select(), showSaveDialog: () => save(), defaultFilePath: async () => URI.file('/') }),
			upcastPartial<IUserDataProfileService>({ get currentProfile() { return profile; } }),
			upcastPartial<ITextFileService>({
				isDirty: () => state.dirty,
				create: async operations => {
					const result = [];
					for (const operation of operations) {
						assert.strictEqual(typeof operation.value, 'string');
						result.push(await files.createFile(operation.resource, VSBuffer.fromString(String(operation.value)), operation.options));
					}
					return result;
				}
			}),
			upcastPartial<IEditorService>({
				openEditor: async input => {
					assert.ok(isResourceDiffEditorInput(input));
					state.after = input.modified.resource;
					state.opens++;
					return state.refuseEditor ? undefined : upcastPartial<ITextDiffEditorPane>({});
				},
				findEditors: () => [], closeEditors: async () => { state.closes++; },
			}),
			upcastPartial<INotificationService>({ info: message => { messages.push(String(message)); } }),
			upcastPartial<ITextModelService>({ registerTextModelContentProvider: (scheme, value) => { providers.set(scheme, value); return toDisposable(() => providers.delete(scheme)); } }),
			upcastPartial<IModelService>({
				getModel: resource => models.get(resource.toString()) ?? null,
				createModel: (value, _language, resource) => {
					if (typeof value !== 'string' || !resource) { throw new Error('Invalid fixture model'); }
					const model = store.add(createTextModel(value, undefined, undefined, resource));
					models.set(resource.toString(), model);
					store.add(model.onWillDispose(() => models.delete(resource.toString())));
					return model;
				},
			}),
		));
		return { service, files, settings, state, messages, providers, models,
			read: async () => (await files.readFile(settings)).value.toString(),
			switchProfile: () => { profile = toUserDataProfile('other', 'Other', URI.file('/other'), URI.file('/cache')); },
			onSave: (action: () => Promise<URI | undefined>) => { save = action; },
			delaySelection: (promise: Promise<URI[] | undefined>) => { select = () => promise; },
		};
	}

	test('preview does not write and Apply merges into the captured profile', async () => {
		const f = await fixture();
		await f.service.importSettings();
		const model = await f.providers.get(settingsPreviewScheme)!.provideTextContent(f.state.after!);
		assert.deepStrictEqual({ original: await f.read(), previewSize: JSON.parse(model!.getValue().replace('// preserve', '') )['fixture.fontSize'], opens: f.state.opens }, { original, previewSize: 16, opens: 1 });
		await f.service.applySettings(f.state.after);
		assert.deepStrictEqual({ values: JSON.parse((await f.read()).replace('// preserve', '')), comment: (await f.read()).includes('// preserve'), closes: f.state.closes }, {
			values: { 'fixture.fontSize': 16, 'fixture.keep': true, 'fixture.apiKey': 'local-fixture' }, comment: true, closes: 1
		});
		assert.strictEqual(model!.isDisposed(), true);
	});

	test('dialog cancellation and preview discard never write settings', async () => {
		const f = await fixture();
		f.state.selected = undefined;
		f.state.destination = undefined;
		await f.service.importSettings(); await f.service.exportSettings();
		f.state.selected = [incoming];
		await f.service.importSettings(); await f.service.discardPreview(f.state.after);
		await assert.rejects(f.service.applySettings(f.state.after), /preview first/);
		assert.strictEqual(await f.read(), original);
	});

	test('rejects dirty settings before import and before Apply', async () => {
		const f = await fixture();
		f.state.dirty = true;
		await assert.rejects(f.service.importSettings(), /unsaved/);
		f.state.dirty = false;
		await f.service.importSettings();
		f.state.dirty = true;
		await assert.rejects(f.service.applySettings(f.state.after), /unsaved/);
		assert.strictEqual(await f.read(), original);
	});

	test('rejects profile switches and stale disk contents after preview', async () => {
		const f = await fixture();
		await f.service.importSettings();
		await f.files.writeFile(f.settings, VSBuffer.fromString('{"fixture.fontSize":20}'));
		await assert.rejects(f.service.applySettings(f.state.after), /changed after the preview/);
		f.switchProfile();
		await assert.rejects(f.service.applySettings(f.state.after), /profile changed/);
		assert.strictEqual(await f.read(), '{"fixture.fontSize":20}');
	});

	test('creates missing settings only after Apply and refuses a racing creation', async () => {
		const f = await fixture(undefined, true);
		await f.service.importSettings();
		assert.strictEqual(await f.files.exists(f.settings), false);
		await f.service.applySettings(f.state.after);
		assert.deepStrictEqual(JSON.parse(await f.read()), { 'fixture.fontSize': 16 });
		await f.files.del(f.settings);
		await f.service.importSettings();
		await f.files.createFile(f.settings, VSBuffer.fromString('{}'));
		await assert.rejects(f.service.applySettings(f.state.after), /changed after the preview/);
	});

	test('write failure keeps the preview available for retry', async () => {
		const f = await fixture(); await f.service.importSettings();
		const fail = sinon.stub(f.files, 'writeFile').rejects(new Error('fixture write failure'));
		try { await assert.rejects(f.service.applySettings(f.state.after), /fixture write failure/); } finally { fail.restore(); }
		assert.strictEqual(await f.read(), original);
		await f.service.applySettings(f.state.after);
		assert.ok((await f.read()).includes('16'));
	});

	test('exports only registered portable settings and blocks export over active settings', async () => {
		const f = await fixture();
		await f.files.writeFile(f.settings, VSBuffer.fromString('{"fixture.fontSize":14,"fixture.apiKey":"fixture","fixture.machine":"path","fixture.restricted":"command","unknown.setting":true}'));
		await f.service.exportSettings();
		assert.deepStrictEqual(JSON.parse((await f.files.readFile(exported)).value.toString()), { 'fixture.fontSize': 14 });
		f.state.destination = f.settings;
		await assert.rejects(f.service.exportSettings(), /separate from/);
	});

	test('filters incoming unregistered and sensitive settings without changing local secrets', async () => {
		const f = await fixture('{"fixture.fontSize":16,"fixture.apiKey":"incoming-fixture","unknown.setting":true}');
		await f.service.importSettings(); await f.service.applySettings(f.state.after);
		assert.deepStrictEqual(JSON.parse((await f.read()).replace('// preserve', '')), { 'fixture.fontSize': 16, 'fixture.keep': true, 'fixture.apiKey': 'local-fixture' });
	});

	test('rejects malformed input and nonlocal resources', async () => {
		const f = await fixture('{broken}');
		await assert.rejects(f.service.importSettings(), /valid settings.json/);
		f.state.selected = [URI.parse('https://example.invalid/settings.json')];
		await assert.rejects(f.service.importSettings(), /local settings file/);
		assert.strictEqual(f.state.opens, 0);
	});

	test('serializes dialogs and refuses multiple outstanding previews', async () => {
		const f = await fixture();
		const deferred = new DeferredPromise<URI[] | undefined>();
		f.delaySelection(deferred.p);
		const first = f.service.importSettings();
		await assert.rejects(f.service.exportSettings(), /in progress/);
		await deferred.complete([incoming]); await first;
		await assert.rejects(f.service.importSettings(), /current settings preview/);
		await assert.rejects(f.service.applySettings(URI.file('/unrelated')), /preview first/);
		assert.strictEqual(await f.read(), original);
	});

	test('failed editor opening releases preview state and closing its model cancels import', async () => {
		const f = await fixture();
		f.state.refuseEditor = true;
		await assert.rejects(f.service.importSettings(), /could not be opened/);
		f.state.refuseEditor = false;
		await f.service.importSettings();
		const model = await f.providers.get(settingsPreviewScheme)!.provideTextContent(f.state.after!);
		model!.dispose();
		await assert.rejects(f.service.applySettings(f.state.after), /preview first/);
		await f.service.importSettings();
	});

	test('export refuses changed settings or a changed profile during the save dialog', async () => {
		const f = await fixture();
		f.onSave(async () => {
			await f.files.writeFile(f.settings, VSBuffer.fromString('{"fixture.fontSize":20}'));
			return exported;
		});
		await assert.rejects(f.service.exportSettings(), /changed while choosing/);
		f.onSave(async () => { f.switchProfile(); return exported; });
		await assert.rejects(f.service.exportSettings(), /profile changed/);
		assert.strictEqual(await f.files.exists(exported), false);
	});

	test('modified preview content cannot silently apply a different snapshot', async () => {
		const f = await fixture(); await f.service.importSettings();
		const model = await f.providers.get(settingsPreviewScheme)!.provideTextContent(f.state.after!);
		model!.setValue('{"fixture.fontSize":99}');
		await assert.rejects(f.service.applySettings(f.state.after), /preview content changed/);
		assert.strictEqual(await f.read(), original);
	});

	test('disposing the service releases preview models and its content provider', async () => {
		const f = await fixture(); await f.service.importSettings();
		const model = await f.providers.get(settingsPreviewScheme)!.provideTextContent(f.state.after!);
		f.service.dispose();
		assert.deepStrictEqual({ providers: f.providers.size, models: f.models.size, disposed: model!.isDisposed() }, { providers: 0, models: 0, disposed: true });
	});

	test('exposes import/export in visible menus and Apply/Discard on preview titles', () => {
		const ids = (menu: MenuId) => MenuRegistry.getMenuItems(menu).flatMap(item => isIMenuItem(item) ? [item.command.id] : []);
		assert.deepStrictEqual({
			preferences: ids(MenuId.MenubarPreferencesMenu).filter(id => id.startsWith('myself.settings.')),
			gear: ids(MenuId.GlobalActivity).filter(id => id.startsWith('myself.settings.')),
			title: ids(MenuId.EditorTitle).filter(id => id.startsWith('myself.settings.')),
		}, {
			preferences: ['myself.settings.exportFile', 'myself.settings.importFile'], gear: ['myself.settings.exportFile', 'myself.settings.importFile'],
			title: ['myself.settings.applyImport', 'myself.settings.discardImport'],
		});
	});
});
