/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ExtensionState } from '../../common/extensions.js';
import { Extension } from '../../browser/extensionsWorkbenchService.js';
import { IExtensionGalleryService, IGalleryExtension, IGalleryExtensionProperties, ILocalExtension } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionType, IExtensionManifest, TargetPlatform } from '../../../../../platform/extensions/common/extensions.js';
import { URI } from '../../../../../base/common/uri.js';
import { getGalleryExtensionId } from '../../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';

suite('Extension Test', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;

	setup(() => {
		instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IProductService, { quality: 'insiders' });
	});

	test('extension is not outdated when there is no local and gallery', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, undefined, undefined, undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is not outdated when there is local and no gallery', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension(), undefined, undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is not outdated when there is no local and has gallery', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, undefined, aGalleryExtension(), undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is not outdated when local and gallery are on same version', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension(), aGalleryExtension(), undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is outdated when local is older than gallery', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }), aGalleryExtension('somext', { version: '1.0.1' }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	test('extension is outdated when local is built in and older than gallery', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }, { type: ExtensionType.System }), aGalleryExtension('somext', { version: '1.0.1' }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	test('extension is not outdated when local is built in and older than gallery but product quality is stable', () => {
		instantiationService.stub(IProductService, { quality: 'stable' });
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }, { type: ExtensionType.System }), aGalleryExtension('somext', { version: '1.0.1' }), undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is outdated when local and gallery are on same version but on different target platforms', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', {}, { targetPlatform: TargetPlatform.WIN32_ARM64 }), aGalleryExtension('somext', {}, { targetPlatform: TargetPlatform.WIN32_X64 }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	test('extension is not outdated when local and gallery are on same version and local is on web', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', {}, { targetPlatform: TargetPlatform.WEB }), aGalleryExtension('somext'), undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is not outdated when local and gallery are on same version and gallery is on web', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext'), aGalleryExtension('somext', {}, { targetPlatform: TargetPlatform.WEB }), undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is not outdated when local is not pre-release but gallery is pre-release', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }), aGalleryExtension('somext', { version: '1.0.1' }, { isPreReleaseVersion: true }), undefined);
		assert.strictEqual(extension.outdated, false);
	});

	test('extension is outdated when local and gallery are pre-releases', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }, { preRelease: true, isPreReleaseVersion: true }), aGalleryExtension('somext', { version: '1.0.1' }, { isPreReleaseVersion: true }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	test('extension is outdated when local was opted to pre-release but current version is not pre-release', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }, { preRelease: true, isPreReleaseVersion: false }), aGalleryExtension('somext', { version: '1.0.1' }, { isPreReleaseVersion: true }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	test('extension is outdated when local is pre-release but gallery is not', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }, { preRelease: true, isPreReleaseVersion: true }), aGalleryExtension('somext', { version: '1.0.1' }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	test('extension is outdated when local was opted pre-release but current version is not and gallery is not', () => {
		const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, aLocalExtension('somext', { version: '1.0.0' }, { preRelease: true, isPreReleaseVersion: false }), aGalleryExtension('somext', { version: '1.0.1' }), undefined);
		assert.strictEqual(extension.outdated, true);
	});

	suite('Local documentation', () => {
		let fileService: FileService;
		let downloads: number;

		setup(() => {
			downloads = 0;
			instantiationService.stub(IExtensionGalleryService, {
				getReadme: async () => { downloads++; return 'downloaded readme'; },
				getChangelog: async () => { downloads++; return 'downloaded changelog'; },
			});
			fileService = disposables.add(new FileService(new NullLogService()));
			disposables.add(fileService.registerProvider('file', disposables.add(new InMemoryFileSystemProvider())));
			disposables.add(fileService.registerProvider('vscode-remote', disposables.add(new InMemoryFileSystemProvider())));
			instantiationService.stub(IFileService, fileService);
		});

		test('gallery assets do not expose or download documentation', async () => {
			const gallery = aGalleryExtension();
			gallery.assets.readme = gallery.assets.changelog = { uri: 'https://example.invalid/doc.md', fallbackUri: 'https://example.invalid/fallback.md' };
			const extension = instantiationService.createInstance(Extension, () => ExtensionState.Uninstalled, () => undefined, undefined, undefined, gallery, undefined);
			await assert.rejects(() => extension.getReadme(CancellationToken.None), /not available/);
			await assert.rejects(() => extension.getChangelog(CancellationToken.None), /not available/);
			assert.deepStrictEqual([extension.hasReadme(), extension.hasChangelog(), downloads], [false, false, 0]);
		});

		test('installed documentation remains available when gallery version is newer', async () => {
			const readmeUrl = URI.file('/readme.md');
			const changelogUrl = URI.file('/changelog.md');
			await fileService.writeFile(readmeUrl, VSBuffer.fromString('installed readme'));
			await fileService.writeFile(changelogUrl, VSBuffer.fromString('installed changelog'));
			const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined,
				aLocalExtension('fixture', { version: '1.0.0' }, { readmeUrl, changelogUrl }), aGalleryExtension('fixture', { version: '2.0.0' }), undefined);
			assert.deepStrictEqual({
				available: [extension.hasReadme(), extension.hasChangelog()],
				readme: await extension.getReadme(CancellationToken.None),
				changelog: await extension.getChangelog(CancellationToken.None), downloads,
			}, { available: [true, true], readme: 'installed readme', changelog: 'installed changelog', downloads: 0 });
		});

		test('remote workspace documentation uses its filesystem provider', async () => {
			const readmeUri = URI.parse('vscode-remote://ssh-remote+fixture/readme.md');
			const changelogUri = URI.parse('vscode-remote://ssh-remote+fixture/changelog.md');
			await fileService.writeFile(readmeUri, VSBuffer.fromString('workspace readme'));
			await fileService.writeFile(changelogUri, VSBuffer.fromString('workspace changelog'));
			const local = aLocalExtension();
			const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined, undefined, undefined, {
				isWorkspaceScoped: true,
				resourceExtension: { type: 'resource', identifier: local.identifier, manifest: local.manifest, location: local.location, readmeUri, changelogUri },
			});
			assert.deepStrictEqual([extension.hasReadme(), extension.hasChangelog(), await extension.getReadme(CancellationToken.None), await extension.getChangelog(CancellationToken.None), downloads],
				[true, true, 'workspace readme', 'workspace changelog', 0]);
		});

		test('network document URIs are rejected before a filesystem read', async () => {
			let reads = 0;
			instantiationService.stub(IFileService, { readFile: async () => { reads++; throw new Error('must not read'); } });
			for (const url of ['https://example.invalid/doc.md', 'http://example.invalid/doc.md', 'file://remote-host/share/doc.md']) {
				const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined,
					aLocalExtension('fixture', {}, { readmeUrl: URI.parse(url), changelogUrl: URI.parse(url) }), undefined, undefined);
				await assert.rejects(() => extension.getReadme(CancellationToken.None), /not available/);
				await assert.rejects(() => extension.getChangelog(CancellationToken.None), /not available/);
				assert.deepStrictEqual([extension.hasReadme(), extension.hasChangelog()], [false, false]);
			}
			assert.deepStrictEqual({ reads, downloads }, { reads: 0, downloads: 0 });
		});

		test('missing and cancelled local reads never fall back to the gallery', async () => {
			const extension = instantiationService.createInstance(Extension, () => ExtensionState.Installed, () => undefined, undefined,
				aLocalExtension('fixture', {}, { readmeUrl: URI.file('/missing.md'), changelogUrl: URI.file('/missing.md') }), aGalleryExtension(), undefined);
			await assert.rejects(() => extension.getReadme(CancellationToken.None));
			await assert.rejects(() => extension.getChangelog(CancellationToken.None));
			await assert.rejects(() => extension.getReadme(CancellationToken.Cancelled), /Canceled/);
			await assert.rejects(() => extension.getChangelog(CancellationToken.Cancelled), /Canceled/);
			assert.strictEqual(downloads, 0);
		});
	});

	function aLocalExtension(name: string = 'someext', manifest: Partial<IExtensionManifest> = {}, properties: Partial<ILocalExtension> = {}): ILocalExtension {
		manifest = { name, publisher: 'pub', version: '1.0.0', ...manifest };
		properties = {
			type: ExtensionType.User,
			location: URI.file(`pub.${name}`),
			identifier: { id: getGalleryExtensionId(manifest.publisher, manifest.name!) },
			targetPlatform: TargetPlatform.UNDEFINED,
			...properties
		};
		return <ILocalExtension>Object.create({ manifest, ...properties });
	}

	function aGalleryExtension(name: string = 'somext', properties: Partial<IGalleryExtension> = {}, galleryExtensionProperties: Partial<IGalleryExtensionProperties> = {}): IGalleryExtension {
		const targetPlatform = galleryExtensionProperties.targetPlatform ?? TargetPlatform.UNDEFINED;
		const galleryExtension = <IGalleryExtension>Object.create({ name, publisher: 'pub', version: '1.0.0', allTargetPlatforms: [targetPlatform], properties: {}, assets: {}, ...properties });
		galleryExtension.properties = { ...galleryExtension.properties, dependencies: [], targetPlatform, ...galleryExtensionProperties };
		galleryExtension.identifier = { id: getGalleryExtensionId(galleryExtension.publisher, galleryExtension.name), uuid: generateUuid() };
		return <IGalleryExtension>galleryExtension;
	}

});
