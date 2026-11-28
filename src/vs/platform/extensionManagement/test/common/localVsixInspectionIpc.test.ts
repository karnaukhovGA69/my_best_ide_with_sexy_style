/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { DefaultURITransformer } from '../../../../base/common/uriIpc.js';
import { mock } from '../../../../base/test/common/mock.js';
import type { IExtensionManagementService } from '../../common/extensionManagement.js';
import { ExtensionManagementChannel, inspectLocalVsixCommand, type ILocalVsixInspection } from '../../common/extensionManagementIpc.js';

suite('Local VSIX inspection IPC', () => {
	const metadata = { id: 'test.fixture', version: '0.1.0', engine: '^1.95.0', sha256: 'a'.repeat(64), bytes: 50 };
	const local = URI.file('/chosen/fixture.vsix');

	function channel(inspect?: (resource: URI, maxBytes: number, token: CancellationToken) => Promise<ILocalVsixInspection>, remote = false) {
		const service = new class extends mock<IExtensionManagementService>() {
			override readonly onInstallExtension = Event.None;
			override readonly onDidInstallExtensions = Event.None;
			override readonly onUninstallExtension = Event.None;
			override readonly onDidUninstallExtension = Event.None;
			override readonly onDidUpdateExtensionMetadata = Event.None;
		};
		return new ExtensionManagementChannel(service, () => remote ? DefaultURITransformer : null, inspect);
	}

	test('dispatches only the normalized local resource, byte limit and cancellation token', async () => {
		const cancellation = new CancellationTokenSource();
		try {
			const server = channel(async (resource, maxBytes, token) => {
				assert.strictEqual(resource.toString(), local.toString());
				assert.strictEqual(maxBytes, 51);
				assert.strictEqual(token, cancellation.token);
				return metadata;
			});
			assert.deepStrictEqual(await server.call('window:1', inspectLocalVsixCommand, [local.toJSON(), 51], cancellation.token), metadata);
		} finally {
			cancellation.dispose();
		}
	});

	test('does not fall through to general extension management when inspection is unavailable', async () => {
		assert.strictEqual(await channel().call('window:1', inspectLocalVsixCommand, [local, 51]), undefined);
		const remote = channel(async () => assert.fail('remote inspection'), true);
		assert.strictEqual(await remote.call('remote', inspectLocalVsixCommand, [local, 51]), undefined);
	});

	test('rejects cancelled, malformed and non-local requests before dispatch', async () => {
		const server = channel(async () => assert.fail('invalid inspection'));
		assert.strictEqual(await server.call('window:1', inspectLocalVsixCommand, [local, 51], CancellationToken.Cancelled), undefined);
		for (const args of [
			undefined,
			[local],
			[local, 1.5],
			[local, '51'],
			[{ scheme: 'file', path: 'relative.vsix' }, 51],
			[{ scheme: 'file', path: '//server/share/fixture.vsix' }, 51],
			[local.with({ authority: 'server' }), 51],
			[local.with({ query: 'x' }), 51],
			[local.with({ fragment: 'x' }), 51],
			[URI.parse('vscode-remote://machine/fixture.vsix'), 51],
		]) {
			assert.strictEqual(await server.call('window:1', inspectLocalVsixCommand, args), undefined);
		}
	});
});
