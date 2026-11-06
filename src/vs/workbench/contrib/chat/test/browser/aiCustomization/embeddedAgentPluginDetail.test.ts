/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { CancellationToken, CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../../../platform/files/common/files.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { AgentPluginItemKind, IAgentPluginItem, IMarketplacePluginItem } from '../../../browser/agentPluginEditor/agentPluginItems.js';
import { getPluginRepository, getPluginSourceUri, getPluginVersion, loadMarketplacePluginContributionEntries, loadPluginReadme, PluginReadmeRenderGuard, resolveInstalledPluginSkillLink, waitForInstalledPlugin } from '../../../browser/aiCustomization/embeddedAgentPluginDetail.js';
import { IMarketplacePlugin, MarketplaceType, PluginSourceKind } from '../../../common/plugins/pluginMarketplaceService.js';
import { parseMarketplaceReference } from '../../../common/plugins/marketplaceReference.js';
import { IAgentPlugin } from '../../../common/plugins/agentPluginService.js';
import { createInMemoryFileService } from '../../../../../../platform/files/test/common/inMemoryFileService.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { dirname } from '../../../../../../base/common/resources.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { createCustomizationMarketplaceInstallationSnapshot, emptyCustomizationMarketplaceInstallationSnapshot } from '../../../common/customizationMarketplaceInstallService.js';
import { CustomizationMarketplaceMediaType, ICustomizationMarketplaceResource } from '../../../../../../platform/customizationMarketplace/common/customizationMarketplaceService.js';
import { ContributionEnablementState } from '../../../common/enablement.js';

function createMarketplaceItem(readmeUri: URI): IMarketplacePluginItem {
	return {
		kind: AgentPluginItemKind.Marketplace,
		name: 'example',
		description: 'Example plugin',
		version: '1.2.3',
		source: 'plugins/example',
		sourceDescriptor: { kind: PluginSourceKind.RelativePath, path: 'plugins/example' },
		marketplace: 'owner/repo',
		marketplaceReference: parseMarketplaceReference('owner/repo')!,
		marketplaceType: MarketplaceType.Copilot,
		readmeUri,
	};
}

suite('embeddedAgentPluginDetail', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('invalidates overlapping renders for the same plugin', () => {
		const guard = new PluginReadmeRenderGuard();
		const first = guard.begin();
		const second = guard.begin();

		assert.deepStrictEqual({
			firstCurrent: guard.isCurrent(first),
			secondCurrent: guard.isCurrent(second),
		}, {
			firstCurrent: false,
			secondCurrent: true,
		});
	});

	test('waits for asynchronous installed plugin discovery', async () => {
		const expectedUri = URI.file('/plugins/example');
		const plugins = observableValue<readonly IAgentPlugin[]>('plugins', []);
		const plugin = new class extends mock<IAgentPlugin>() {
			override readonly uri = expectedUri;
		}();
		const result = waitForInstalledPlugin({ plugins }, expectedUri, CancellationToken.None);

		plugins.set([plugin], undefined);

		assert.strictEqual(await result, plugin);
	});

	test('stops waiting for installed plugin discovery when cancelled', async () => {
		const plugins = observableValue<readonly IAgentPlugin[]>('plugins', []);
		const cts = disposables.add(new CancellationTokenSource());
		const result = waitForInstalledPlugin({ plugins }, URI.file('/plugins/example'), cts.token);

		cts.cancel();

		assert.strictEqual(await result, undefined);
	});

	test('reads marketplace plugin versions', () => {
		assert.strictEqual(
			getPluginVersion(createMarketplaceItem(URI.parse('https://example.test/README.md'))),
			'1.2.3',
		);
	});

	test('uses trustworthy GitHub repository provenance', () => {
		const marketplaceItem = createMarketplaceItem(URI.parse('https://example.test/README.md'));
		const configuredPlugin = {
			...marketplaceItem,
			version: marketplaceItem.version!,
			sourceDescriptor: { kind: PluginSourceKind.GitHub, repo: 'octo-org/example' },
		} satisfies IMarketplacePlugin;
		const installedUri = URI.file('/plugins/example');
		const createInstalledItem = (fromMarketplace?: IMarketplacePlugin, uri = installedUri) => ({
			kind: AgentPluginItemKind.Installed,
			name: 'example',
			description: 'Example plugin',
			plugin: new class extends mock<IAgentPlugin>() {
				override readonly uri = uri;
				override readonly label = 'example';
				override readonly fromMarketplace = fromMarketplace;
			}(),
		} satisfies IAgentPluginItem);
		const installedItem = createInstalledItem(configuredPlugin);
		const providerItem = createInstalledItem();
		const catalogInstallations = createCustomizationMarketplaceInstallationSnapshot([{
			resource: {
				sourceId: 'github-feed',
				identifier: 'example',
				displayName: 'Example',
				description: 'Example plugin',
				mediaType: CustomizationMarketplaceMediaType.CopilotPlugin,
				tags: [],
				capabilities: [],
				representativeQueries: [],
				repository: URI.parse('https://github.com/catalog/example'),
				installation: { kind: 'plugin', repository: 'catalog/example', ref: 'abc123', path: 'plugins/example' },
			} satisfies ICustomizationMarketplaceResource,
			state: { kind: 'installed', target: { kind: 'plugin', uri: installedUri, name: 'example' } },
		}, {
			resource: {
				sourceId: 'github-feed',
				identifier: 'same-name',
				displayName: 'Example',
				description: 'Different plugin with the same name',
				mediaType: CustomizationMarketplaceMediaType.CopilotPlugin,
				tags: [],
				capabilities: [],
				representativeQueries: [],
				repository: URI.parse('https://github.com/catalog/wrong-example'),
			} satisfies ICustomizationMarketplaceResource,
			state: { kind: 'installed', target: { kind: 'plugin', uri: URI.file('/plugins/different'), name: 'same-name' } },
		}]);
		const sameNameItem = {
			...createInstalledItem(undefined, URI.file('/plugins/unrecorded')),
			name: 'same-name',
		} satisfies IAgentPluginItem;

		assert.deepStrictEqual({
			marketplaceRepository: getPluginRepository(marketplaceItem, emptyCustomizationMarketplaceInstallationSnapshot)?.toString(),
			configuredPluginRepository: getPluginRepository(installedItem, catalogInstallations)?.toString(),
			providerCatalogRepository: getPluginRepository(providerItem, catalogInstallations)?.toString(),
			providerCatalogSource: getPluginSourceUri(providerItem, catalogInstallations)?.toString(),
			sameNameRepository: getPluginRepository(sameNameItem, catalogInstallations)?.toString(),
			missingRepository: getPluginRepository(providerItem, emptyCustomizationMarketplaceInstallationSnapshot)?.toString(),
			nonGitHubRepository: getPluginRepository({
				...marketplaceItem,
				sourceDescriptor: { kind: PluginSourceKind.GitUrl, url: 'https://example.com/example.git' },
				marketplaceReference: parseMarketplaceReference('https://example.com/marketplace.git')!,
			}, emptyCustomizationMarketplaceInstallationSnapshot)?.toString(),
		}, {
			marketplaceRepository: 'https://github.com/owner/repo',
			configuredPluginRepository: 'https://github.com/octo-org/example',
			providerCatalogRepository: 'https://github.com/catalog/example',
			providerCatalogSource: 'https://github.com/catalog/example/tree/abc123/plugins/example',
			sameNameRepository: undefined,
			missingRepository: undefined,
			nonGitHubRepository: undefined,
		});
	});

	test('reads contribution details from a local source without cloning', async () => {
		const pluginUri = URI.from({ scheme: Schemas.inMemory, path: '/plugins/example' });
		const testFileService = createInMemoryFileService(disposables, Schemas.inMemory);
		const writeFile = (path: string, content: string) => testFileService.writeFile(
			URI.from({ scheme: Schemas.inMemory, path }),
			VSBuffer.fromString(content),
		);
		await writeFile('/plugins/example/.plugin/plugin.json', JSON.stringify({ name: 'example' }));
		await writeFile('/plugins/example/skills/deploy/SKILL.md', '---\nname: deploy\ndescription: Deploy safely\n---');
		await writeFile('/plugins/example/agents/reviewer.agent.md', '---\nname: reviewer\ndescription: Reviews changes\n---');
		await writeFile('/plugins/example/commands/release.md', '# Release');
		await writeFile('/plugins/example/rules/quality.instructions.md', '# Quality');
		await writeFile('/plugins/example/.mcp.json', JSON.stringify({ mcpServers: { example: { command: 'node' } } }));

		const entries = await loadMarketplacePluginContributionEntries(
			createMarketplaceItem(URI.parse('https://example.test/README.md')),
			{
				getPluginInstallUri() { return pluginUri; },
			},
			testFileService,
			{ async userHome() { return URI.file('/home/test'); } },
			new NullLogService(),
			CancellationToken.None,
		);

		assert.deepStrictEqual(entries.map(entry => ({
			kind: entry.kind,
			items: entry.items.map(item => item.name),
		})), [
			{ kind: 'agents', items: ['reviewer'] },
			{ kind: 'skills', items: ['deploy'] },
			{ kind: 'commands', items: ['release'] },
			{ kind: 'instructions', items: ['quality'] },
			{ kind: 'mcp', items: ['example'] },
		]);
	});

	test('uses the local README URI as the Markdown base URI', async () => {
		const uri = URI.file('/plugins/example/README.md');
		const reads: string[] = [];
		const readme = await loadPluginReadme(createMarketplaceItem(uri), {
			readFile: async resource => { reads.push(resource.toString()); return { value: VSBuffer.fromString('[Guide](./docs/guide.md)') } as Awaited<ReturnType<IFileService['readFile']>>; },
		});
		assert.deepStrictEqual(reads, [uri.toString()]);
		assert.deepStrictEqual(readme, { content: '[Guide](./docs/guide.md)', baseUri: uri });
	});

	test('skips remote README locations without reading any provider', async () => {
		const reads: string[] = [];
		for (const location of [
			'https://github.com/owner/repo/blob/main/README.md',
			'https://example.test/README.md',
			'http://example.test/README.md',
			'vscode-remote://ssh-remote+example/plugins/README.md',
			'file://example.test/share/README.md',
			'custom-provider:/README.md',
		]) {
			const result = await loadPluginReadme(createMarketplaceItem(URI.parse(location)), {
				readFile: async uri => { reads.push(uri.toString()); throw new Error('Unexpected read'); },
			});
			assert.strictEqual(result, undefined);
		}
		assert.deepStrictEqual(reads, []);
	});

	test('resolves enabled installed plugin README skill links to the skill file', () => {
		const pluginUri = URI.file('/plugins/example');
		const skillUri = URI.joinPath(pluginUri, 'skills', 'review', 'SKILL.md');
		const enablement = observableValue('enablement', ContributionEnablementState.EnabledProfile);
		const policyEnablement = observableValue<boolean | undefined>('policyEnablement', undefined);
		const item = {
			kind: AgentPluginItemKind.Installed,
			name: 'example',
			description: 'Example plugin',
			plugin: new class extends mock<IAgentPlugin>() {
				override readonly enablement = enablement;
				override readonly policyEnablement = policyEnablement;
				override readonly skills = observableValue('skills', [{ name: 'review', uri: skillUri }]);
			}(),
		} satisfies IAgentPluginItem;

		const directory = resolveInstalledPluginSkillLink(item, dirname(skillUri).toString())?.toString();
		const file = resolveInstalledPluginSkillLink(item, skillUri.toString())?.toString();
		const unrelated = resolveInstalledPluginSkillLink(item, URI.joinPath(pluginUri, 'docs', 'guide.md').toString())?.toString();
		const marketplace = resolveInstalledPluginSkillLink(createMarketplaceItem(URI.parse('https://example.test/README.md')), skillUri.toString())?.toString();
		enablement.set(ContributionEnablementState.DisabledProfile, undefined);
		const disabled = resolveInstalledPluginSkillLink(item, skillUri.toString())?.toString();
		enablement.set(ContributionEnablementState.EnabledProfile, undefined);
		policyEnablement.set(false, undefined);
		const policyBlocked = resolveInstalledPluginSkillLink(item, skillUri.toString())?.toString();

		assert.deepStrictEqual({
			directory,
			file,
			unrelated,
			marketplace,
			disabled,
			policyBlocked,
		}, {
			directory: skillUri.toString(),
			file: skillUri.toString(),
			unrelated: undefined,
			marketplace: undefined,
			disabled: undefined,
			policyBlocked: undefined,
		});
	});

	test('treats a missing installed README as expected absence', async () => {
		const item = {
			kind: AgentPluginItemKind.Installed,
			name: 'example',
			description: 'Example plugin',
			plugin: new class extends mock<IAgentPlugin>() {
				override readonly uri = URI.file('/plugins/example');
			}(),
		} satisfies IAgentPluginItem;
		const readme = await loadPluginReadme(
			item,
			{
				readFile: async () => {
					throw new FileOperationError('Not found', FileOperationResult.FILE_NOT_FOUND);
				},
			},
		);

		assert.strictEqual(readme, undefined);
	});

	test('preserves local read errors other than missing files', async () => {
		const error = new Error('Permission denied');
		await assert.rejects(loadPluginReadme(createMarketplaceItem(URI.file('/plugins/example/README.md')), {
			readFile: async () => { throw error; },
		}), candidate => candidate === error);
	});

});
