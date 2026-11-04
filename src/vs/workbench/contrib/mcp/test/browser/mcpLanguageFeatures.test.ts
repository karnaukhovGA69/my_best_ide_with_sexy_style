/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CodeLensProvider, CompletionItemProvider, InlayHintsProvider } from '../../../../../editor/common/languages.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../../../../editor/common/services/languageFeaturesService.js';
import { IAgentHostConnectionsService } from '../../../../../platform/agentHost/common/agentHostConnectionsService.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IMarkerService } from '../../../../../platform/markers/common/markers.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IAgentHostCustomizationService } from '../../../chat/browser/agentSessions/agentHost/agentHostCustomizationService.js';
import { IChatWidget, IChatWidgetService } from '../../../chat/browser/chat.js';
import { McpLanguageFeatures } from '../../browser/mcpLanguageFeatures.js';
import { IMcpRegistry } from '../../common/mcpRegistryTypes.js';
import { IMcpService, IMcpWorkbenchService } from '../../common/mcpTypes.js';

suite('Workbench - MCP - Language features removed', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createServices() {
		const calls: string[] = [];
		const language = new LanguageFeaturesService();
		const secrets = store.add(new Emitter<string>());
		const widgets = store.add(new Emitter<IChatWidget | undefined>());
		const sessions = store.add(new Emitter<void>());
		const connections = store.add(new Emitter<void>());
		const customizations = store.add(new Emitter<void>());
		const inputs = store.add(new Emitter<void>());
		store.add(language.codeLensProvider.onDidChange(() => calls.push('code lens registry changed')));
		store.add(language.inlayHintsProvider.onDidChange(() => calls.push('inlay hint registry changed')));
		const services = new ServiceCollection(
			[ILanguageFeaturesService, language],
			[IMcpRegistry, upcastPartial<IMcpRegistry>({ onDidChangeInputs: inputs.event })],
			[IMcpWorkbenchService, upcastPartial<IMcpWorkbenchService>({})],
			[IMcpService, upcastPartial<IMcpService>({})],
			[IChatWidgetService, upcastPartial<IChatWidgetService>({
				onDidChangeFocusedWidget: widgets.event, onDidChangeFocusedSession: sessions.event,
				get lastFocusedWidget() { calls.push('read widget'); return undefined; },
			})],
			[IAgentHostCustomizationService, upcastPartial<IAgentHostCustomizationService>({ onDidChangeCustomizations: customizations.event })],
			[IAgentHostConnectionsService, upcastPartial<IAgentHostConnectionsService>({
				onDidChangeConnections: connections.event,
				get connections() { calls.push('read connections'); return []; },
			})],
			[IMarkerService, upcastPartial<IMarkerService>({
				changeOne: () => { calls.push('change markers'); }, remove: () => { calls.push('remove markers'); },
			})],
			[IConfigurationResolverService, upcastPartial<IConfigurationResolverService>({})],
			[ISecretStorageService, upcastPartial<ISecretStorageService>({ onDidChangeSecret: secrets.event })],
		);
		const instantiation = store.add(new InstantiationService(services, true));
		return {
			language, calls, instantiation,
			listeners: () => [secrets, widgets, sessions, connections, customizations, inputs].map(e => e.hasListeners()),
			fireChanges: () => {
				secrets.fire('test-secret'); widgets.fire(undefined); sessions.fire();
				connections.fire(); customizations.fire(); inputs.fire();
			},
		};
	}

	test('startup and disposal require no infrastructure services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const contribution = store.add(instantiation.createInstance(McpLanguageFeatures));
		contribution.dispose();
		contribution.dispose();
	});

	test('does not register MCP editor providers or subscribe to services', () => {
		const { language, calls, instantiation, listeners, fireChanges } = createServices();
		const contribution = store.add(instantiation.createInstance(McpLanguageFeatures));
		fireChanges();
		const active = {
			lenses: language.codeLensProvider.allNoModel().length,
			hints: language.inlayHintsProvider.allNoModel().length,
			listeners: listeners(),
		};
		contribution.dispose();
		fireChanges();
		assert.deepStrictEqual({ active, calls, listeners: listeners() }, {
			active: { lenses: 0, hints: 0, listeners: [false, false, false, false, false, false] },
			calls: [], listeners: [false, false, false, false, false, false],
		});
	});

	test('preserves ordinary completion, code lens and inlay hint registrations', () => {
		const { language, calls, instantiation, fireChanges } = createServices();
		const completion: CompletionItemProvider = { _debugDisplayName: 'test', provideCompletionItems: () => ({ suggestions: [] }) };
		const lenses: CodeLensProvider = { provideCodeLenses: () => ({ lenses: [], dispose() { } }) };
		const hints: InlayHintsProvider = { provideInlayHints: () => ({ hints: [], dispose() { } }) };
		store.add(language.completionProvider.register('json', completion));
		store.add(language.codeLensProvider.register('json', lenses));
		store.add(language.inlayHintsProvider.register('json', hints));
		calls.length = 0;
		const contribution = store.add(instantiation.createInstance(McpLanguageFeatures));
		fireChanges();
		const snapshot = () => ({
			completion: language.completionProvider.allNoModel(),
			lenses: language.codeLensProvider.allNoModel(), hints: language.inlayHintsProvider.allNoModel(),
		});
		const active = snapshot();
		contribution.dispose();
		const expected = { completion: [completion], lenses: [lenses], hints: [hints] };
		assert.deepStrictEqual({ active, disposed: snapshot(), calls }, { active: expected, disposed: expected, calls: [] });
	});
});
