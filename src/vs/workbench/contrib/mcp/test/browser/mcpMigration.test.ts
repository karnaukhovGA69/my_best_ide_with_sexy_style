/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { FileChangesEvent, FileChangeType, IFileContent, IFileService } from '../../../../../platform/files/common/files.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { IJSONEditingService } from '../../../../services/configuration/common/jsonEditing.js';
import { IWorkbenchLocalMcpServer, IWorkbenchMcpManagementService } from '../../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { McpConfigMigrationContribution } from '../../browser/mcpMigration.js';

suite('Workbench - MCP - Configuration migration disabled', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('existing contribution can be instantiated and disposed without infrastructure services', () => {
		const instantiationService = store.add(new InstantiationService(new ServiceCollection(), true));
		const contribution = store.add(instantiationService.createInstance(McpConfigMigrationContribution));
		contribution.dispose();
	});

	const cases = [
		{ name: 'legacy MCP servers', text: '{ "editor.fontSize": 14, "mcp": { "servers": { "example": { "command": "test-server" } } } }', remote: true },
		{ name: 'malformed settings', text: '{ "mcp": ', remote: true },
		{ name: 'ordinary local settings without a remote', text: '{ "editor.fontSize": 14 }', remote: false },
	];

	for (const fixture of cases) {
		test(`does not read, watch, rewrite or prompt for ${fixture.name}`, async () => {
			const calls: string[] = [];
			const localSettings = URI.from({ scheme: 'inmemory', path: '/local/settings.json' });
			const remoteSettings = URI.from({ scheme: 'inmemory', path: '/remote/settings.json' });
			const changes = store.add(new Emitter<FileChangesEvent>());
			const fileService = new class extends mock<IFileService>() {
				override readonly onDidFilesChange = changes.event;
				override async readFile(): Promise<IFileContent> {
					calls.push('read');
					return upcastPartial<IFileContent>({ value: VSBuffer.fromString(fixture.text) });
				}
				override watch() {
					calls.push('watch');
					return Disposable.None;
				}
			};
			const services = new ServiceCollection(
				[IFileService, fileService],
				[IUserDataProfileService, upcastPartial<IUserDataProfileService>({ currentProfile: upcastPartial<IUserDataProfile>({ settingsResource: localSettings }) })],
				[IRemoteAgentService, upcastPartial<IRemoteAgentService>({ getEnvironment: async () => {
					calls.push('remote environment');
					return fixture.remote ? upcastPartial<IRemoteAgentEnvironment>({ settingsPath: remoteSettings }) : null;
				} })],
				[IWorkbenchMcpManagementService, upcastPartial<IWorkbenchMcpManagementService>({ install: async () => {
					calls.push('install');
					return upcastPartial<IWorkbenchLocalMcpServer>({ name: 'example' });
				} })],
				[IJSONEditingService, upcastPartial<IJSONEditingService>({ write: async () => { calls.push('write'); } })],
				[INotificationService, new class extends mock<INotificationService>() {
					override prompt(): never {
						calls.push('prompt');
						throw new Error('Unexpected MCP migration prompt');
					}
				}],
				[ICommandService, new class extends mock<ICommandService>() {
					override async executeCommand<T>(): Promise<T> {
						calls.push('command');
						throw new Error('Unexpected MCP migration command');
					}
				}],
				[ILogService, store.add(new NullLogService())],
			);
			const instantiationService = store.add(new InstantiationService(services));
			const contribution = store.add(instantiationService.createInstance(McpConfigMigrationContribution));
			await timeout(0);
			changes.fire(new FileChangesEvent([
				{ type: FileChangeType.UPDATED, resource: localSettings },
				{ type: FileChangeType.UPDATED, resource: remoteSettings },
			], false));
			await timeout(0);
			assert.deepStrictEqual({ calls, listening: changes.hasListeners() }, { calls: [], listening: false });
			contribution.dispose();
		});
	}
});
