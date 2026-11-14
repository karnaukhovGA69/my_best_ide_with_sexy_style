/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { join } from '../../../../base/common/path.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { zip } from '../../../../base/node/zip.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../configuration/common/configuration.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { IDownloadService } from '../../../download/common/download.js';
import { INativeEnvironmentService } from '../../../environment/common/environment.js';
import { FileService } from '../../../files/common/fileService.js';
import { IFileService } from '../../../files/common/files.js';
import { DiskFileSystemProvider } from '../../../files/node/diskFileSystemProvider.js';
import { TestInstantiationService } from '../../../instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../log/common/log.js';
import { IProductService } from '../../../product/common/productService.js';
import { ITelemetryService } from '../../../telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../telemetry/common/telemetryUtils.js';
import { IUriIdentityService } from '../../../uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../../uriIdentity/common/uriIdentityService.js';
import { IUserDataProfilesService, UserDataProfilesService } from '../../../userDataProfile/common/userDataProfile.js';
import { IExtensionGalleryManifestService } from '../../common/extensionGalleryManifest.js';
import { EXTENSION_INSTALL_LOCAL_VSIX_CONTEXT, IAllowedExtensionsService, IExtensionGalleryService, IExtensionInfo, InstallExtensionResult } from '../../common/extensionManagement.js';
import { IExtensionsProfileScannerService } from '../../common/extensionsProfileScannerService.js';
import { IExtensionsScannerService } from '../../common/extensionsScannerService.js';
import { ExtensionManagementService } from '../../node/extensionManagementService.js';
import { IExtensionSignatureVerificationService } from '../../node/extensionSignatureVerificationService.js';
import { ExtensionsProfileScannerService } from '../../node/extensionsProfileScannerService.js';
import { ExtensionsScannerService } from '../../node/extensionsScannerService.js';

suite('Native VSIX installation', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	let root: URI;
	let vsix: URI;
	let service: ExtensionManagementService;
	let lookups: IExtensionInfo[][];
	let controlManifestRequests: number;
	let installResults: readonly InstallExtensionResult[];
	let downloadLocation: URI | undefined;

	setup(async () => {
		root = URI.file(await mkdtemp(join(tmpdir(), 'extension-management-test-')));
		vsix = joinPath(root, 'test.vsix');
		lookups = [];
		controlManifestRequests = 0;
		installResults = [];
		downloadLocation = undefined;
		const instantiationService = disposables.add(new TestInstantiationService());
		const logService = new NullLogService();
		const fileService = disposables.add(new FileService(logService));
		const provider = disposables.add(new class extends DiskFileSystemProvider {
			override watch() { return Disposable.None; }
		}(logService));
		disposables.add(fileService.registerProvider(root.scheme, provider));
		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(ILogService, logService);
		instantiationService.stub(ITelemetryService, NullTelemetryService);
		instantiationService.stub(IProductService, { version: '1.146.0', builtInExtensionsEnabledWithAutoUpdates: [] });
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(IExtensionGalleryManifestService, {});
		instantiationService.stub(IExtensionSignatureVerificationService, {});
		instantiationService.stub(IAllowedExtensionsService, { isAllowed: () => true });
		instantiationService.stub(IExtensionGalleryService, {
			isEnabled: () => true,
			async getExtensions(extensions) {
				lookups.push([...extensions]);
				return [];
			},
			async getExtensionsControlManifest() {
				controlManifestRequests++;
				return { malicious: [], deprecated: {}, search: [] };
			},
		});
		instantiationService.stub(IDownloadService, {
			async download(_resource, target) {
				downloadLocation = target;
				await copyFile(vsix.fsPath, target.fsPath);
			},
		});
		const environmentService = instantiationService.stub(INativeEnvironmentService, {
			userHome: root,
			userRoamingDataHome: root,
			cacheHome: joinPath(root, 'cache'),
			extensionsDownloadLocation: joinPath(root, 'downloads'),
			extensionsPath: joinPath(root, 'extensions').fsPath,
			builtinExtensionsPath: joinPath(root, 'builtin').fsPath,
		});
		await Promise.all(['builtin', 'downloads', 'extensions'].map(name => fileService.createFolder(joinPath(root, name))));
		const uriIdentityService = disposables.add(new UriIdentityService(fileService));
		instantiationService.stub(IUriIdentityService, uriIdentityService);
		instantiationService.stub(IUserDataProfilesService, disposables.add(new UserDataProfilesService(environmentService, fileService, uriIdentityService, logService)));
		instantiationService.stub(IExtensionsProfileScannerService, disposables.add(instantiationService.createInstance(ExtensionsProfileScannerService)));
		instantiationService.stub(IExtensionsScannerService, disposables.add(instantiationService.createInstance(ExtensionsScannerService)));
		service = disposables.add(instantiationService.createInstance(ExtensionManagementService));
		disposables.add(service.onDidInstallExtensions(results => installResults = results));
	});

	teardown(async () => {
		await rm(root.fsPath, { recursive: true, force: true });
	});

	async function writeVSIX(extensionDependencies?: string[]): Promise<void> {
		await zip(vsix.fsPath, [{
			path: 'extension/package.json',
			contents: JSON.stringify({ name: 'private-test', publisher: 'pub', version: '1.0.0', engines: { vscode: '*' }, extensionDependencies }),
		}]);
	}

	test('local VSIX installs without looking up the package in the gallery', async () => {
		await writeVSIX();
		const local = await service.install(vsix);
		assert.strictEqual(local.identifier.id, 'pub.private-test');
		assert.strictEqual(local.source, 'vsix');
		assert.strictEqual(local.publisherId, null);
		assert.strictEqual((await service.getInstalled()).length, 1);
		assert.deepStrictEqual(lookups, []);
		assert.strictEqual(controlManifestRequests, 0);
		assert.strictEqual(downloadLocation, undefined);
		assert.strictEqual(installResults[0].source?.toString(), vsix.toString());
		assert.strictEqual(installResults[0].context?.[EXTENSION_INSTALL_LOCAL_VSIX_CONTEXT], true);
	});

	test('local VSIX still looks up declared dependencies', async () => {
		await writeVSIX(['pub.dependency']);
		assert.strictEqual((await service.install(vsix)).identifier.id, 'pub.private-test');
		assert.deepStrictEqual(lookups.map(infos => infos.map(info => info.id)), [['pub.dependency']]);
	});

	test('URL VSIX still looks up the package without exposing the original URL in install results', async () => {
		await writeVSIX();
		const url = URI.parse('https://example.invalid/extension.vsix?token=temporary');
		assert.strictEqual((await service.install(url)).identifier.id, 'pub.private-test');
		assert.deepStrictEqual(lookups, [[{ id: 'pub.private-test', version: '1.0.0' }], [{ id: 'pub.private-test' }]]);
		assert.ok(downloadLocation);
		assert.strictEqual(installResults[0].source?.toString(), downloadLocation.toString());
		assert.strictEqual(installResults[0].context?.[EXTENSION_INSTALL_LOCAL_VSIX_CONTEXT], false);
		assert.ok(!JSON.stringify(installResults).includes(url.query));
	});
});
