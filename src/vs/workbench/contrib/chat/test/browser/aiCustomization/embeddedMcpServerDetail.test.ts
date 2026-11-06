/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $ } from '../../../../../../base/browser/dom.js';
import { McpServerConfigurationFormAccessibilityHelp } from '../../../../mcp/browser/mcpServerConfigurationFormAccessibility.js';
import { DeferredPromise, timeout } from '../../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { Event } from '../../../../../../base/common/event.js';
import { constObservable } from '../../../../../../base/common/observable.js';
import { hasKey } from '../../../../../../base/common/types.js';
import { URI } from '../../../../../../base/common/uri.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CodeEditorWidget } from '../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { ITextModel } from '../../../../../../editor/common/model.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IResourceEditorInput } from '../../../../../../platform/editor/common/editor.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { IFileContent, IFileService } from '../../../../../../platform/files/common/files.js';
import { McpServerType } from '../../../../../../platform/mcp/common/mcpPlatformTypes.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { IEditableMcpServerConfiguration, IMcpWorkbenchService, McpServerInstallState } from '../../../../mcp/common/mcpTypes.js';
import { McpResourceFormat } from '../../../../../../platform/mcp/common/mcpWorkspaceConfiguration.js';
import { EmbeddedMcpServerDetail, IMcpServerDetailInput } from '../../../browser/aiCustomization/embeddedMcpServerDetail.js';
import { createVSCodeHarnessDescriptor, ICustomizationHarnessService, ICustomizationMcpServerCompatibility } from '../../../common/customizationHarnessService.js';
import { ChatConfiguration } from '../../../common/constants.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';

suite('EmbeddedMcpServerDetail', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const uri = URI.file('/home/test/.copilot/mcp-config.json');
	const definition = '{ "command": "memory-server", "args": [] }';
	const content = `{\n\t"mcpServers": {\n\t\t"local-memory": ${definition},\n\t\t"other": { "command": "other-server" }\n\t}\n}`;

	function createDetail(editable?: (source: URI, name: string) => IEditableMcpServerConfiguration | undefined, compatibility?: readonly ICustomizationMcpServerCompatibility[]) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const reads: { uri: URI; result: DeferredPromise<IFileContent> }[] = [];
		const executedCommands: unknown[][] = [];
		const openedEditors: IResourceEditorInput[] = [];
		let model: ITextModel | null = null;
		instantiationService.stub(ICommandService, {
			executeCommand: async (...args: unknown[]) => { executedCommands.push(args); return undefined; },
		});
		instantiationService.stub(IEditorService, new class extends mock<IEditorService>() {
			override async openEditor(...args: unknown[]): Promise<undefined> {
				openedEditors.push(args[0] as IResourceEditorInput);
				return undefined;
			}
		}());
		instantiationService.stub(IFileService, {
			readFile: resource => {
				const result = new DeferredPromise<IFileContent>();
				reads.push({ uri: resource, result });
				return result.p;
			},
		});
		instantiationService.stub(IMcpWorkbenchService, {
			onChange: Event.None,
			resolveEditableMcpServerConfiguration: async (source, name) => editable?.(source, name),
		});
		const harness = compatibility
			? {
				...createVSCodeHarnessDescriptor(),
				mcpServerCompatibilityProvider: {
					acquire: () => ({ servers: constObservable(compatibility), isResolved: constObservable(true), dispose: () => { } }),
				},
			}
			: createVSCodeHarnessDescriptor();
		if (compatibility) {
			instantiationService.stub(IConfigurationService, new TestConfigurationService({ [ChatConfiguration.ChatCustomizationsMigrationEnabled]: true }));
		}
		instantiationService.stub(ICustomizationHarnessService, {
			activeSessionResource: constObservable(URI.parse('copilot:/session')),
			availableHarnesses: constObservable([harness]),
			getActiveDescriptor: () => harness,
		});
		instantiationService.stubInstance(CodeEditorWidget, {
			setModel: value => {
				assert.ok(value === null || (value && hasKey(value, { getValue: true })));
				model = value;
			},
			updateOptions: () => { },
			dispose: () => { },
		});
		const detail = store.add(instantiationService.createInstance(EmbeddedMcpServerDetail, $('div'), {
			openMigrationPage: () => { },
		}));
		const input: IMcpServerDetailInput = {
			id: 'memory', name: 'local-memory', label: 'Local Memory',
			installState: McpServerInstallState.Installed,
			source: { uri },
		};
		const snapshot = () => ({
			definition: model?.getValue(),
			emptyMessage: detail.element.querySelector<HTMLElement>('.mcp-detail-definition-empty')!.textContent,
			editorVisible: detail.element.querySelector<HTMLElement>('.mcp-detail-definition-editor')!.style.display !== 'none',
		});
		const complete = (index: number, text = content) => reads[index].result.complete(new class extends mock<IFileContent>() {
			override readonly value = VSBuffer.fromString(text);
		}());
		return { detail, input, reads, snapshot, complete, executedCommands, openedEditors, instantiationService };
	}

	test('loads only the selected definition after migration metadata changes during the read', async () => {
		const { detail, input, reads, snapshot, complete } = createDetail();
		detail.setInput(input);
		detail.setMigratable(false);
		await complete(0);

		assert.deepStrictEqual({
			...snapshot(),
			source: reads[0].uri,
			label: detail.element.querySelector('.editor-item-path')!.textContent,
		}, {
			definition,
			emptyMessage: 'No definition is available for this MCP server.',
			editorVisible: true,
			source: uri,
			label: 'mcp-config.json',
		});
	});

	test('shows read failures after migration metadata changes', async () => {
		const { detail, input, reads, snapshot } = createDetail();
		detail.setInput(input);
		detail.setMigratable(false);
		await reads[0].result.error(new Error('File unavailable'));

		assert.deepStrictEqual(snapshot(), {
			definition: undefined,
			emptyMessage: 'The MCP server definition could not be loaded.',
			editorVisible: false,
		});
	});

	test('prefers an explicit source range to the server name lookup', async () => {
		const { detail, input, snapshot, complete } = createDetail();
		detail.setInput({ ...input, source: { uri, range: new Range(4, 12, 4, 41) } });
		await complete(0);

		assert.strictEqual(snapshot().definition, '{ "command": "other-server" }');
	});

	test('shows the source document when no server entry can be located', async () => {
		const { detail, input, snapshot, complete } = createDetail();
		detail.setInput({ ...input, name: 'missing' });
		await complete(0);

		assert.strictEqual(snapshot().definition, content);
	});

	for (const fail of [false, true]) {
		test(`ignores stale read ${fail ? 'failures' : 'results'} after selecting another server`, async () => {
			const { detail, input, reads, snapshot, complete } = createDetail();
			detail.setInput(input);
			detail.setInput({ ...input, id: 'other', name: 'other' });
			await complete(1);
			const current = snapshot();
			if (fail) {
				await reads[0].result.error(new Error('Old read failed'));
			} else {
				await complete(0);
			}

			assert.deepStrictEqual({ definition: current.definition, afterOldRead: snapshot() }, {
				definition: '{ "command": "other-server" }',
				afterOldRead: current,
			});
		});
	}

	test('ignores pending reads after clearing the input', async () => {
		const { detail, input, snapshot, complete } = createDetail();
		detail.setInput(input);
		detail.clearInput();
		await complete(0);

		assert.deepStrictEqual(snapshot(), {
			definition: undefined,
			emptyMessage: 'No definition is available for this MCP server.',
			editorVisible: false,
		});
	});

	test('shows where a server comes from when it has no configuration file', async () => {
		const { detail, input, complete } = createDetail();
		const opened: string[] = [];
		const path = detail.element.querySelector<HTMLAnchorElement>('.editor-item-path')!;
		const editConfiguration = detail.element.querySelector<HTMLElement>('.embedded-detail-title-actions .monaco-button')!;
		const header = () => ({
			label: path.style.display === 'none' ? undefined : path.textContent,
			link: path.hasAttribute('href'),
			ariaLabel: path.getAttribute('aria-label'),
			provenance: path.classList.contains('provenance'),
			editConfiguration: editConfiguration.style.display !== 'none',
		});
		const builtin = { label: 'Built-in: Copilot' };
		const extension = { label: 'Built-in: GitHub Copilot Chat', ariaLabel: 'Open extension details for GitHub Copilot Chat', open: () => opened.push('extension') };

		detail.setInput({ ...input, source: undefined, provenance: builtin });
		const agent = header();
		detail.setInput({ ...input, source: undefined, provenance: extension });
		const contributed = header();
		path.click();
		detail.setInput({ ...input, source: undefined });
		const unknown = header();
		detail.setInput({ ...input, provenance: builtin });
		const file = header();
		await complete(0);

		assert.deepStrictEqual({ agent, contributed, unknown, file, opened }, {
			agent: { label: 'Built-in: Copilot', link: false, ariaLabel: null, provenance: true, editConfiguration: false },
			contributed: { label: 'Built-in: GitHub Copilot Chat', link: true, ariaLabel: 'Open extension details for GitHub Copilot Chat', provenance: true, editConfiguration: false },
			unknown: { label: undefined, link: false, ariaLabel: null, provenance: false, editConfiguration: false },
			file: { label: 'mcp-config.json', link: true, ariaLabel: 'Open mcp-config.json', provenance: false, editConfiguration: true },
			opened: ['extension'],
		});
	});

	test('explains a missing definition and links to the setting that controls the server', () => {
		const { detail, input, snapshot, executedCommands } = createDetail();
		const empty = detail.element.querySelector<HTMLElement>('.mcp-detail-definition-empty')!;
		const settingsLink = () => empty.querySelector<HTMLAnchorElement>('.mcp-detail-definition-settings-link');
		const read = () => ({ message: empty.querySelector('.mcp-detail-definition-message')?.textContent, link: settingsLink()?.textContent, ariaLabel: settingsLink()?.getAttribute('aria-label'), editorVisible: snapshot().editorVisible });
		const builtin = { id: 'github', name: 'github-mcp-server', label: 'github-mcp-server', installState: McpServerInstallState.Installed };
		const message = 'Copilot configures this server automatically, so its definition can\'t be viewed or edited.';

		detail.setInput({ ...builtin, definitionUnavailable: { message, settingId: 'chat.agentHost.githubMcpServer.enabled' } });
		const withSetting = read();
		settingsLink()!.click();
		detail.setInput({ ...builtin, definitionUnavailable: { message } });
		const withoutSetting = read();
		detail.setInput({ ...builtin });
		const unexplained = read();
		detail.setInput({ ...input, source: undefined, config: { type: McpServerType.LOCAL, command: 'memory-server' }, definitionUnavailable: { message, settingId: 'chat.agentHost.githubMcpServer.enabled' } });

		assert.deepStrictEqual({ withSetting, withoutSetting, unexplained, withDefinition: read(), executedCommands }, {
			withSetting: { message, link: 'Open Settings', ariaLabel: 'Open Settings for github-mcp-server', editorVisible: false },
			withoutSetting: { message, link: undefined, ariaLabel: undefined, editorVisible: false },
			unexplained: { message: 'No definition is available for this MCP server.', link: undefined, ariaLabel: undefined, editorVisible: false },
			withDefinition: { message: 'No definition is available for this MCP server.', link: undefined, ariaLabel: undefined, editorVisible: true },
			executedCommands: [['workbench.action.openSettings', '@id:chat.agentHost.githubMcpServer.enabled']],
		});
	});

	test('says a server needs to be migrated manually in its compatibility card, or in the migration card when it is supported', () => {
		const reason = 'The client secret is stored in VS Code.';
		const render = (compatibility: ICustomizationMcpServerCompatibility, manualReviewReason: string) => {
			const { detail, input } = createDetail(undefined, [compatibility]);
			const serverInput = { ...input, compatibilityId: compatibility.id };
			detail.setInput(serverInput);
			detail.setManualReviewReason(manualReviewReason);
			return { detail, input: serverInput };
		};
		const read = (detail: EmbeddedMcpServerDetail) => [...detail.element.querySelectorAll<HTMLElement>('.mcp-detail-diagnostic-section')]
			.filter(section => section.style.display !== 'none')
			.map(section => ({
				summary: section.querySelector('.mcp-detail-diagnostic-summary')!.textContent,
				messages: [...section.querySelectorAll('.mcp-detail-diagnostic-message, .mcp-detail-diagnostic-list > li, .mcp-detail-migration-description')].map(message => message.textContent),
			}));

		const { detail: partial, input } = render({ id: 'memory', kind: 'partiallySupported', details: ['OAuth client configuration is ignored.'] }, reason);
		const partiallySupported = read(partial);
		partial.updateInput({ ...input, label: 'Renamed' });
		const afterUpdate = read(partial);
		partial.setMigratable(true);
		const migratable = read(partial);
		partial.setMigratable(false);
		partial.setManualReviewReason(undefined);
		const cleared = read(partial);
		const unsupported = read(render({ id: 'memory', kind: 'unsupported', details: ['Copilot cannot start this server.'] }, 'Copilot cannot start this server.').detail);
		const supported = read(render({ id: 'memory', kind: 'supported' }, reason).detail);

		const partialCard = { summary: 'Partially supported by Local', messages: ['OAuth client configuration is ignored.', `This server needs to be migrated manually. ${reason}`] };
		assert.deepStrictEqual({ partiallySupported, afterUpdate, migratable, cleared, unsupported, supported }, {
			partiallySupported: [partialCard],
			afterUpdate: [partialCard],
			migratable: [
				{ summary: 'Partially supported by Local', messages: ['OAuth client configuration is ignored.'] },
				{ summary: 'Migrate MCP Server', messages: ['This MCP server needs to be migrated to keep working.'] },
			],
			cleared: [{ summary: 'Partially supported by Local', messages: ['OAuth client configuration is ignored.'] }],
			unsupported: [{ summary: 'Not supported by Local', messages: ['Copilot cannot start this server.', 'This server needs to be migrated manually.'] }],
			supported: [{ summary: 'Migrate MCP Server', messages: [`This server needs to be migrated manually. ${reason}`] }],
		});
	});

	test('updates an open detail when the host enriches a restored server, keeping migration state', () => {
		const { detail } = createDetail();
		const name = () => detail.element.querySelector('.editor-item-name')?.textContent;
		const path = () => detail.element.querySelector('.editor-item-path')?.textContent;
		const message = () => detail.element.querySelector('.mcp-detail-definition-message')?.textContent;
		const settingsLink = () => detail.element.querySelector('.mcp-detail-definition-settings-link')?.textContent;
		const read = () => ({ name: name(), path: path(), message: message(), settingsLink: settingsLink() });
		const restored: IMcpServerDetailInput = {
			id: 'session:server-7', name: 'github-copilot-connector-1', label: 'github-copilot-connector-1',
			installState: McpServerInstallState.Installed,
		};
		const enriched: IMcpServerDetailInput = {
			...restored,
			label: 'Linear',
			provenance: { label: 'Managed by Copilot' },
			definitionUnavailable: { message: 'Copilot manages this server, so its definition can\'t be viewed or edited.', settingId: 'chat.example.enabled' },
		};

		detail.setInput(restored);
		detail.setMigratable(true);
		const before = read();
		const definitionEmpty = detail.element.querySelector('.mcp-detail-definition-message');
		detail.updateInput({ ...enriched, id: 'session:other-server', label: 'Other' });
		const otherServer = read();
		detail.updateInput(enriched);
		const after = read();
		const migration = detail.element.querySelector<HTMLElement>('.mcp-detail-diagnostic-card.migration')?.closest<HTMLElement>('section')?.style.display;
		const renderedMessage = detail.element.querySelector('.mcp-detail-definition-message');
		detail.updateInput({ ...enriched, provenance: { label: 'Managed by Copilot' }, error: undefined });

		assert.deepStrictEqual({
			before,
			otherServer,
			after,
			migrationKept: migration !== 'none',
			rerendered: definitionEmpty !== renderedMessage,
			unchangedKeepsNodes: detail.element.querySelector('.mcp-detail-definition-message') === renderedMessage,
		}, {
			before: { name: 'github-copilot-connector-1', path: '', message: 'No definition is available for this MCP server.', settingsLink: undefined },
			otherServer: { name: 'github-copilot-connector-1', path: '', message: 'No definition is available for this MCP server.', settingsLink: undefined },
			after: { name: 'Linear', path: 'Managed by Copilot', message: 'Copilot manages this server, so its definition can\'t be viewed or edited.', settingsLink: 'Open Settings' },
			migrationKept: true,
			rerendered: true,
			unchangedKeepsNodes: true,
		});
	});

	test('shows a host configuration that arrives after the detail opened', () => {
		const { detail, snapshot } = createDetail();
		const read = () => ({ ...snapshot(), path: detail.element.querySelector('.editor-item-path')?.textContent });
		const restored: IMcpServerDetailInput = {
			id: 'session:server-8', name: 'my-mcp-server', label: 'my-mcp-server',
			installState: McpServerInstallState.Installed,
		};

		detail.setInput(restored);
		const before = read();
		detail.updateInput({ ...restored, provenance: { label: 'Agent host configuration' }, config: { type: McpServerType.LOCAL, command: 'my-mcp-server' } });

		assert.deepStrictEqual({ before, after: read() }, {
			before: { definition: undefined, emptyMessage: 'No definition is available for this MCP server.', editorVisible: false, path: '' },
			after: {
				definition: '{\n\t"servers": {\n\t\t"my-mcp-server": {\n\t\t\t"type": "stdio",\n\t\t\t"command": "my-mcp-server"\n\t\t}\n\t}\n}\n',
				emptyMessage: 'No definition is available for this MCP server.',
				editorVisible: true,
				path: 'Agent host configuration',
			},
		});
	});

	test('keeps servers from VS Code mcp.json files read-only', async () => {
		const { detail, input, snapshot } = createDetail();
		detail.setInput({ ...input, source: { uri: URI.file('/home/test/.vscode/mcp.json') }, config: { type: McpServerType.LOCAL, command: 'memory-server' } });
		await timeout(0);

		assert.deepStrictEqual({
			editorVisible: snapshot().editorVisible,
			formVisible: detail.element.querySelector('.mcp-detail-configuration-form') !== null,
			heading: detail.element.querySelector<HTMLElement>('.mcp-detail-section-title')!.style.display !== 'none',
			diagnosticsText: detail.element.querySelector('.mcp-detail-diagnostics')!.textContent,
		}, {
			editorVisible: true,
			formVisible: false,
			heading: true,
			diagnosticsText: '',
		});
	});

	for (const format of [McpResourceFormat.CopilotGlobal, McpResourceFormat.WorkspaceRoot]) {
		test(`shared ${format} configuration remains read-only without resolving editable inputs`, async () => {
			let editableRequests = 0;
			let saves = 0;
			const config = { type: McpServerType.LOCAL as const, command: 'fixture-server' };
			const { detail, input, snapshot, openedEditors } = createDetail(() => {
				editableRequests++;
				return { config, format, save: async () => { saves++; } };
			});
			detail.setInput({ ...input, config });
			await timeout(0);
			assert.deepStrictEqual({ editableRequests, saves, form: detail.element.querySelector('.mcp-detail-configuration-form'), inputs: detail.element.querySelectorAll('input').length, editorVisible: snapshot().editorVisible }, {
				editableRequests: 0, saves: 0, form: null, inputs: 0, editorVisible: true,
			});
			detail.element.querySelector<HTMLElement>('a.editor-item-path')?.click();
			await timeout(0);
			assert.strictEqual(openedEditors.length, 1);
			assert.strictEqual(openedEditors[0].resource?.toString(), uri.toString());
		});
	}

	test('removed form accessibility registration never matches or accesses services', () => {
		const help = new McpServerConfigurationFormAccessibilityHelp();
		assert.strictEqual(help.when.evaluate({ getValue() { throw new Error('Context accessed'); } }), false);
		const accessor = { get(): never { throw new Error('Service accessed'); } };
		assert.strictEqual(help.getProvider(accessor), undefined);
	});
});
