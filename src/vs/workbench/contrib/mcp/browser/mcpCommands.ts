/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assertNever } from '../../../../base/common/assert.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { basename } from '../../../../base/common/resources.js';
import { hasKey } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { ILocalizedString, localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { getCustomizationScopeEnablement } from '../../../../platform/agentHost/common/customizationEnablement.js';
import { CustomizationEnablementKind, McpServerStatus } from '../../../../platform/agentHost/common/state/protocol/state.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { mcpAutoStartConfig, McpAutoStartValue } from '../../../../platform/mcp/common/mcpManagement.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { StorageScope } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, IWorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from '../../../browser/actions/workspaceCommands.js';
import { ActiveEditorContext, RemoteNameContext, ResourceContextKey, WorkbenchStateContext, WorkspaceFolderCountContext } from '../../../common/contextkeys.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IAccountQuery, IAuthenticationQueryService } from '../../../services/authentication/common/authenticationQuery.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IRemoteUserDataProfilesService } from '../../../services/userDataProfile/common/remoteUserDataProfiles.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { getMcpServerDisplayLabel, IAgentHostCustomizationService } from '../../chat/browser/agentSessions/agentHost/agentHostCustomizationService.js';
import { setAgentHostPluginEnablement } from '../../chat/browser/agentPluginActions.js';
import { AICustomizationManagementCommands, AICustomizationManagementSection, IAICustomizationWorkspaceService } from '../../chat/common/aiCustomizationWorkspaceService.js';
import { IAgentPluginService } from '../../chat/common/plugins/agentPluginService.js';
import { ChatContextKeys } from '../../chat/common/actions/chatContextKeys.js';
import { IChatElicitationRequest, IChatToolInvocation } from '../../chat/common/chatService/chatService.js';
import { ChatModeKind } from '../../chat/common/constants.js';
import { ContributionEnablementState, isContributionDisabled } from '../../chat/common/enablement.js';
import { ILanguageModelToolsService } from '../../chat/common/tools/languageModelToolsService.js';
import { extensionsFilterSubMenu } from '../../extensions/common/extensions.js';
import { TEXT_FILE_EDITOR_ID } from '../../files/common/files.js';
import { McpCommandIds } from '../common/mcpCommandIds.js';
import { mcpWorkspaceRootConfig } from '../common/mcpConfiguration.js';
import { McpContextKeys } from '../common/mcpContextKeys.js';
import { IMcpCopilotGlobalConfigurationService } from '../common/mcpCopilotGlobalConfigurationService.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { HasInstalledMcpServersContext, IMcpSamplingService, IMcpServer, IMcpServerStartOpts, IMcpService, InstalledMcpServersViewId, McpCapability, McpConnectionState, McpDefinitionReference, mcpOAuthClientSecretStorageKey } from '../common/mcpTypes.js';
import { McpAddConfigurationCommand, McpInstallFromManifestCommand } from './mcpCommandsAddConfiguration.js';
import { McpConfigurationDestination } from './mcpConfigurationDestination.js';

// acroynms do not get localized
const category: ILocalizedString = {
	original: 'MCP',
	value: 'MCP',
};

export class ListMcpServerCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ListServer,
			title: localize2('mcp.list', 'List Servers'),
			icon: Codicon.server,
			category,
			f1: true,
			precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
			menu: [{
				when: ContextKeyExpr.and(
					ContextKeyExpr.or(
						ContextKeyExpr.and(ContextKeyExpr.equals(`config.${mcpAutoStartConfig}`, McpAutoStartValue.Never), McpContextKeys.hasUnknownTools),
						McpContextKeys.hasServersWithErrors,
					),
					ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
					ChatContextKeys.lockedToCodingAgent.negate(),
					ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
				),
				id: MenuId.ChatInput,
				group: 'navigation',
				order: 101,
			}],
		});
	}

	override async run(_accessor: ServicesAccessor) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

interface IListMcpServerServices {
	readonly chatWidgetService: IChatWidgetService;
	readonly agentHostCustomizations: IAgentHostCustomizationService;
	readonly mcpService: IMcpService;
	readonly commandService: ICommandService;
	readonly quickInput: IQuickInputService;
	readonly notificationService: INotificationService;
	readonly logService: ILogService;
}

type AgentHostMcpServerLifecycleAction = 'start' | 'stop';
type IAgentHostMcpServer = ReturnType<IAgentHostCustomizationService['getMcpServers']>[number];

function canStartAgentHostMcpServer(server: IAgentHostMcpServer): boolean {
	return server.enabled && (server.status === McpServerStatus.Stopped || server.status === McpServerStatus.Error);
}

function canStopAgentHostMcpServer(server: IAgentHostMcpServer): boolean {
	return server.enabled && (
		server.status === McpServerStatus.Starting
		|| server.status === McpServerStatus.Ready
		|| server.status === McpServerStatus.AuthRequired
	);
}

async function runAgentHostMcpServerLifecycleAction(server: IAgentHostMcpServer, action: AgentHostMcpServerLifecycleAction, services: Pick<IListMcpServerServices, 'notificationService' | 'logService'>): Promise<void> {
	try {
		if (action === 'start' && canStartAgentHostMcpServer(server)) {
			await server.start();
		} else if (action === 'stop' && canStopAgentHostMcpServer(server)) {
			await server.stop();
		}
	} catch (error) {
		services.logService.error(`Failed to ${action} MCP server '${server.name}'`, error);
		const message = error instanceof Error ? error.message : String(error);
		const label = getMcpServerDisplayLabel(server);
		services.notificationService.error(action === 'start'
			? localize('mcp.agentHost.startError', "Failed to start MCP server '{0}': {1}", label, message)
			: localize('mcp.agentHost.stopError', "Failed to stop MCP server '{0}': {1}", label, message));
	}
}

function mcpServerStatusToLabel(status: McpServerStatus): string {
	switch (status) {
		case McpServerStatus.Starting:
			return localize('mcp.agentHost.status.starting', 'Starting');
		case McpServerStatus.Ready:
			return localize('mcp.agentHost.status.ready', 'Running');
		case McpServerStatus.AuthRequired:
			return localize('mcp.agentHost.status.authRequired', 'Authentication required');
		case McpServerStatus.Error:
			return localize('mcp.agentHost.status.error', 'Error');
		case McpServerStatus.Stopped:
			return localize('mcp.agentHost.status.stopped', 'Stopped');
		default:
			return '';
	}
}

type AgentHostMcpServerEnablementAction = 'enableProfile' | 'disableProfile' | 'enableWorkspace' | 'disableWorkspace' | 'enableSession' | 'disableSession';

interface AgentHostEnablementItemType extends IQuickPickItem {
	action: AgentHostMcpServerEnablementAction;
}

function getAgentHostMcpServerEnablementItems(server: IAgentHostMcpServer, hasWorkspace: boolean, scopes: readonly ('global' | 'workspace' | 'session')[] = ['global', 'workspace', 'session']): AgentHostEnablementItemType[] {
	const enablement = getCustomizationScopeEnablement(server);
	const items: AgentHostEnablementItemType[] = [];
	if (scopes.includes('global')) {
		items.push({
			label: enablement.global ? localize('mcp.agentHost.disable', 'Disable') : localize('mcp.agentHost.enable', 'Enable'),
			action: enablement.global ? 'disableProfile' : 'enableProfile',
		});
	}
	if (scopes.includes('workspace') && hasWorkspace) {
		items.push({
			label: enablement.workspace ? localize('mcp.agentHost.disableWorkspace', 'Disable (Workspace)') : localize('mcp.agentHost.enableWorkspace', 'Enable (Workspace)'),
			action: enablement.workspace ? 'disableWorkspace' : 'enableWorkspace',
		});
	}
	if (scopes.includes('session')) {
		items.push({
			label: enablement.session ? localize('mcp.agentHost.disableSession', 'Disable (Session)') : localize('mcp.agentHost.enableSession', 'Enable (Session)'),
			action: enablement.session ? 'disableSession' : 'enableSession',
		});
	}
	return items;
}

function getLocalMcpServerEnablementItems(disabled: boolean, isEmptyWorkbench: boolean, includeWorkspace = true): AgentHostEnablementItemType[] {
	const items: AgentHostEnablementItemType[] = [];
	if (disabled) {
		items.push({ label: localize('mcp.agentHost.enable', 'Enable'), action: 'enableProfile' });
		if (includeWorkspace && !isEmptyWorkbench) {
			items.push({ label: localize('mcp.agentHost.enableWorkspace', 'Enable (Workspace)'), action: 'enableWorkspace' });
		}
	} else {
		items.push({ label: localize('mcp.agentHost.disable', 'Disable'), action: 'disableProfile' });
		if (includeWorkspace && !isEmptyWorkbench) {
			items.push({ label: localize('mcp.agentHost.disableWorkspace', 'Disable (Workspace)'), action: 'disableWorkspace' });
		}
	}
	return items;
}

function enablementStateForAction(action: Exclude<AgentHostMcpServerEnablementAction, 'enableSession' | 'disableSession'>): ContributionEnablementState {
	switch (action) {
		case 'enableProfile':
			return ContributionEnablementState.EnabledProfile;
		case 'disableProfile':
			return ContributionEnablementState.DisabledProfile;
		case 'enableWorkspace':
			return ContributionEnablementState.EnabledWorkspace;
		case 'disableWorkspace':
			return ContributionEnablementState.DisabledWorkspace;
	}
}

export function findLocalMcpServer(mcpService: IMcpService, server: IAgentHostMcpServer): IMcpServer | undefined {
	const servers = mcpService.servers.get();
	const separator = server.id.indexOf('/');
	const rawId = separator >= 0 ? server.id.slice(separator + 1) : server.id;
	const idMatches = servers.filter(candidate => candidate.definition.id === rawId);
	if (idMatches.length === 1) {
		return idMatches[0];
	}
	const nameMatches = servers.filter(candidate => candidate.definition.label === server.name);
	return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

export class McpAgentHostServerOptionsCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.AgentHostServerOptions,
			title: localize2('mcp.agentHostOptions', 'Agent Host Server Options'),
			category,
			f1: false,
		});
	}

	override async run(accessor: ServicesAccessor, agentHostSession: URI, customizationId: string): Promise<void> {
		const agentHostCustomizations = accessor.get(IAgentHostCustomizationService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const logService = accessor.get(ILogService);
		const aiCustomizationWorkspaceService = accessor.get(IAICustomizationWorkspaceService);
		const agentPluginService = accessor.get(IAgentPluginService);
		const mcpService = accessor.get(IMcpService);

		const server = agentHostCustomizations.getMcpServers(agentHostSession).find(s => s.id === customizationId);
		if (!server) {
			return;
		}

		type ItemType = { action: 'showOutput' | 'authenticate' | 'enablePlugin' | AgentHostMcpServerLifecycleAction | AgentHostMcpServerEnablementAction } & IQuickPickItem;

		const items: (ItemType | IQuickPickSeparator)[] = [
			{ type: 'separator', label: localize('mcp.actions.status', 'Status') },
		];
		if (canStartAgentHostMcpServer(server)) {
			items.push({
				label: localize('mcp.start', 'Start Server'),
				description: mcpServerStatusToLabel(server.status),
				action: 'start',
			});
		} else if (canStopAgentHostMcpServer(server)) {
			items.push({
				label: localize('mcp.stop', 'Stop Server'),
				description: mcpServerStatusToLabel(server.status),
				action: 'stop',
			});
		}

		const pluginDisabled = server.disabledReason?.source === 'plugin';
		const localServer = findLocalMcpServer(mcpService, server);
		const durableProfileDisabled = localServer !== undefined && !mcpService.enablementModel.readProfileEnabled(localServer.definition.id);
		const isEmptyWorkbench = aiCustomizationWorkspaceService.getActiveProjectRoot() === undefined;
		items.push({ type: 'separator', label: localize('mcp.actions.enablement', 'Enablement') });
		if (pluginDisabled) {
			items.push({
				label: localize('mcp.agentHost.enablePlugin', "Enable Plugin"),
				action: 'enablePlugin',
			});
		} else {
			items.push(
				...(localServer
					? [
						...getLocalMcpServerEnablementItems(durableProfileDisabled, isEmptyWorkbench, false),
						...getAgentHostMcpServerEnablementItems(server, agentHostCustomizations.getWorkingDirectories(agentHostSession).length > 0, ['workspace', 'session']),
					]
					: getAgentHostMcpServerEnablementItems(server, agentHostCustomizations.getWorkingDirectories(agentHostSession).length > 0)),
			);
		}

		if (server.enabled && server.state.kind === McpServerStatus.AuthRequired) {
			items.push({
				label: localize('mcp.agentHost.authenticate', 'Authenticate'),
				description: server.state.resource.resource,
				action: 'authenticate',
			});
		}

		// Every agent-host MCP server has a per-server diagnostics channel.
		items.push({
			label: localize('mcp.showOutput', 'Show Output'),
			action: 'showOutput',
		});

		const picked = await quickInputService.pick(items, {
			placeHolder: getMcpServerDisplayLabel(server),
		});

		if (!picked || !hasKey(picked, { action: true })) {
			return;
		}

		if (picked.action === 'showOutput') {
			agentHostCustomizations.showMcpServerLog(agentHostSession, server.id);
			return;
		}

		if (picked.action === 'authenticate') {
			await agentHostCustomizations.authenticateMcpServer(agentHostSession, server.id);
			return;
		}

		if (picked.action === 'start' || picked.action === 'stop') {
			await runAgentHostMcpServerLifecycleAction(server, picked.action, { notificationService, logService });
			return;
		}

		if (picked.action === 'enablePlugin') {
			const reason = server.disabledReason;
			if (reason?.source === 'plugin') {
				const decision = reason.plugin.enablement?.[0];
				if (decision) {
					await setAgentHostPluginEnablement(agentHostCustomizations, agentPluginService, agentHostSession, reason.plugin, decision.kind, true);
				}
			}
			return;
		}

		if (localServer && (picked.action === 'enableProfile' || picked.action === 'disableProfile')) {
			const state = enablementStateForAction(picked.action);
			mcpService.enablementModel.setEnabled(localServer.definition.id, state);
			return;
		}

		const scope = picked.action === 'enableProfile' || picked.action === 'disableProfile'
			? CustomizationEnablementKind.Global
			: picked.action === 'enableWorkspace' || picked.action === 'disableWorkspace'
				? CustomizationEnablementKind.Workspace
				: CustomizationEnablementKind.Session;
		const enabled = picked.action === 'enableProfile' || picked.action === 'enableWorkspace' || picked.action === 'enableSession';
		agentHostCustomizations.setCustomizationEnablement(agentHostSession, server.id, server.enablement, scope, enabled);
	}
}

interface ActionItem extends IQuickPickItem {
	action: 'start' | 'stop' | 'restart' | 'showOutput' | 'config' | 'configSampling' | 'samplingLog' | 'resources' | 'enable';
}

interface AuthActionItem extends IQuickPickItem {
	action: 'disconnect' | 'signout';
	accountQuery: IAccountQuery;
}

export class McpConfirmationServerOptionsCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ServerOptionsInConfirmation,
			title: localize2('mcp.options', 'Server Options'),
			category,
			icon: Codicon.settingsGear,
			f1: false,
			menu: [{
				id: MenuId.ChatConfirmationMenu,
				when: ContextKeyExpr.and(
					ContextKeyExpr.equals('chatConfirmationPartSource', 'mcp'),
					ContextKeyExpr.or(
						ContextKeyExpr.equals('chatConfirmationPartType', 'chatToolConfirmation'),
						ContextKeyExpr.equals('chatConfirmationPartType', 'elicitation'),
					),
				),
				group: 'navigation'
			}],
		});
	}

	override async run(accessor: ServicesAccessor, arg: IChatToolInvocation | IChatElicitationRequest): Promise<void> {
		const toolsService = accessor.get(ILanguageModelToolsService);
		if (arg.kind === 'toolInvocation') {
			const tool = toolsService.getTool(arg.toolId);
			if (tool?.source.type === 'mcp') {
				accessor.get(ICommandService).executeCommand(McpCommandIds.ServerOptions, tool.source.definitionId);
			}
		} else if (arg.kind === 'elicitation2') {
			if (arg.source?.type === 'mcp') {
				accessor.get(ICommandService).executeCommand(McpCommandIds.ServerOptions, arg.source.definitionId);
			}
		} else {
			assertNever(arg);
		}
	}
}

export class McpServerOptionsCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ServerOptions,
			title: localize2('mcp.options', 'Server Options'),
			category,
			f1: false,
		});
	}

	override async run(accessor: ServicesAccessor, id: string): Promise<void> {
		const mcpService = accessor.get(IMcpService);
		const quickInputService = accessor.get(IQuickInputService);
		const mcpRegistry = accessor.get(IMcpRegistry);
		const editorService = accessor.get(IEditorService);
		const commandService = accessor.get(ICommandService);
		const samplingService = accessor.get(IMcpSamplingService);
		const authenticationQueryService = accessor.get(IAuthenticationQueryService);
		const authenticationService = accessor.get(IAuthenticationService);
		const server = mcpService.servers.get().find(s => s.definition.id === id);
		if (!server) {
			return;
		}

		const collection = mcpRegistry.collections.get().find(c => c.id === server.collection.id);
		const serverDefinition = collection?.serverDefinitions.get().find(s => s.id === server.definition.id);

		const items: (ActionItem | AuthActionItem | IQuickPickSeparator)[] = [];
		const serverState = server.connectionState.get();
		const disabled = isContributionDisabled(server.enablement.get());

		items.push({ type: 'separator', label: localize('mcp.actions.status', 'Status') });

		if (disabled) {
			items.push({
				label: localize('mcp.enableWorkspace', 'Enable Server (Workspace)'),
				action: 'enable'
			});
		} else if (McpConnectionState.canBeStarted(serverState.state)) {
			// Only show start when server is stopped or in error state
			items.push({
				label: localize('mcp.start', 'Start Server'),
				action: 'start'
			});
		} else {
			items.push({
				label: localize('mcp.stop', 'Stop Server'),
				action: 'stop'
			});
			items.push({
				label: localize('mcp.restart', 'Restart Server'),
				action: 'restart'
			});
		}

		items.push(...this._getAuthActions(authenticationQueryService, server.definition.id));

		const configTarget = serverDefinition?.presentation?.origin || collection?.presentation?.origin;
		if (configTarget) {
			items.push({
				label: localize('mcp.config', 'Show Configuration'),
				action: 'config',
			});
		}

		items.push({
			label: localize('mcp.showOutput', 'Show Output'),
			action: 'showOutput'
		});

		items.push(
			{ type: 'separator', label: localize('mcp.actions.sampling', 'Sampling') },
			{
				label: localize('mcp.configAccess', 'Configure Model Access'),
				description: localize('mcp.showOutput.description', 'Set the models the server can use via MCP sampling'),
				action: 'configSampling'
			},
		);


		if (samplingService.hasLogs(server)) {
			items.push({
				label: localize('mcp.samplingLog', 'Show Sampling Requests'),
				description: localize('mcp.samplingLog.description', 'Show the sampling requests for this server'),
				action: 'samplingLog',
			});
		}

		const capabilities = server.capabilities.get();
		if (capabilities === undefined || (capabilities & McpCapability.Resources)) {
			items.push({ type: 'separator', label: localize('mcp.actions.resources', 'Resources') });
			items.push({
				label: localize('mcp.resources', 'Browse Resources'),
				action: 'resources',
			});
		}

		const pick = await quickInputService.pick(items, {
			placeHolder: localize('mcp.selectAction', 'Select action for \'{0}\'', server.definition.label),
		});

		if (!pick) {
			return;
		}

		switch (pick.action) {
			case 'enable':
				mcpService.enablementModel.setEnabled(server.definition.id, ContributionEnablementState.EnabledWorkspace);
				break;
			case 'start':
				await server.start({ promptType: 'all-untrusted' });
				server.showOutput();
				break;
			case 'stop':
				await server.stop();
				break;
			case 'restart':
				await server.stop();
				await server.start({ promptType: 'all-untrusted' });
				break;
			case 'disconnect':
				await server.stop();
				await this._handleAuth(authenticationService, pick.accountQuery, server.definition, false);
				break;
			case 'signout':
				await server.stop();
				await this._handleAuth(authenticationService, pick.accountQuery, server.definition, true);
				break;
			case 'showOutput':
				server.showOutput();
				break;
			case 'config':
				editorService.openEditor({
					resource: URI.isUri(configTarget) ? configTarget : configTarget!.uri,
					options: { selection: URI.isUri(configTarget) ? undefined : configTarget!.range }
				});
				break;
			case 'configSampling':
				return commandService.executeCommand(McpCommandIds.ConfigureSamplingModels, server);
			case 'resources':
				return commandService.executeCommand(McpCommandIds.BrowseResources, server);
			case 'samplingLog':
				editorService.openEditor({
					resource: undefined,
					contents: samplingService.getLogText(server),
					label: localize('mcp.samplingLog.title', 'MCP Sampling: {0}', server.definition.label),
				});
				break;
			default:
				assertNever(pick);
		}
	}

	private _getAuthActions(
		authenticationQueryService: IAuthenticationQueryService,
		serverId: string
	): AuthActionItem[] {
		const result: AuthActionItem[] = [];
		// Really, this should only ever have one entry.
		for (const [providerId, accountName] of authenticationQueryService.mcpServer(serverId).getAllAccountPreferences()) {

			const accountQuery = authenticationQueryService.provider(providerId).account(accountName);
			if (!accountQuery.mcpServer(serverId).isAccessAllowed()) {
				continue; // skip accounts that are not allowed
			}
			// If there are multiple allowed servers/extensions, other things are using this provider
			// so we show a disconnect action, otherwise we show a sign out action.
			if (accountQuery.entities().getEntityCount().total > 1) {
				result.push({
					action: 'disconnect',
					label: localize('mcp.disconnect', 'Disconnect Account'),
					description: `(${accountName})`,
					accountQuery
				});
			} else {
				result.push({
					action: 'signout',
					label: localize('mcp.signOut', 'Sign Out'),
					description: `(${accountName})`,
					accountQuery
				});
			}
		}
		return result;
	}

	private async _handleAuth(
		authenticationService: IAuthenticationService,
		accountQuery: IAccountQuery,
		definition: McpDefinitionReference,
		signOut: boolean
	) {
		const { providerId, accountName } = accountQuery;
		accountQuery.mcpServer(definition.id).setAccessAllowed(false, definition.label);
		if (signOut) {
			const accounts = await authenticationService.getAccounts(providerId);
			const account = accounts.find(a => a.label === accountName);
			if (account) {
				const sessions = await authenticationService.getSessions(providerId, undefined, { account });
				for (const session of sessions) {
					await authenticationService.removeSession(providerId, session.id);
				}
			}
		}
	}
}

/** Compatibility contribution without MCP action rendering, observers or timers. */
export class MCPServerActionRendering extends Disposable implements IWorkbenchContribution { }

export class ResetMcpTrustCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ResetTrust,
			title: localize2('mcp.resetTrust', "Reset Trust"),
			category,
			f1: true,
			precondition: ContextKeyExpr.and(McpContextKeys.toolsCount.greater(0), ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
		});
	}

	run(_accessor: ServicesAccessor): void {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}


export class ResetMcpCachedTools extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ResetCachedTools,
			title: localize2('mcp.resetCachedTools', "Reset Cached Tools"),
			category,
			f1: true,
			precondition: ContextKeyExpr.and(McpContextKeys.toolsCount.greater(0), ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
		});
	}

	run(_accessor: ServicesAccessor): void {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class AddConfigurationAction extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.AddConfiguration,
			title: localize2('mcp.addConfiguration', "Add Server..."),
			metadata: {
				description: localize2('mcp.addConfiguration.description', "Installs a new Model Context protocol to the mcp.json settings"),
			},
			category,
			f1: true,
			precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
			menu: {
				id: MenuId.EditorContent,
				when: ContextKeyExpr.and(
					ContextKeyExpr.or(
						ContextKeyExpr.regex(ResourceContextKey.Path.key, /\.vscode[/\\]mcp\.json$/),
						ContextKeyExpr.and(ContextKeyExpr.equals(`config.${mcpWorkspaceRootConfig}`, true), ContextKeyExpr.regex(ResourceContextKey.Path.key, /[/\\]\.mcp\.json$/)),
					),
					ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID),
					ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
				)
			}
		});
	}

	async run(accessor: ServicesAccessor, configUri?: URI | string): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const notificationService = accessor.get(INotificationService);
		try {
			const target = configUri === undefined ? undefined : await instantiationService.createInstance(McpConfigurationDestination).getExplicitTarget(configUri);
			if (configUri !== undefined && target === undefined) {
				return;
			}
			await instantiationService.createInstance(McpAddConfigurationCommand, target).run();
		} catch (error) {
			if (!isCancellationError(error)) {
				notificationService.error(error);
			}
		}
	}
}

export class InstallFromManifestAction extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.InstallFromManifest,
			title: localize2('mcp.installFromManifest', "Install Server from Manifest..."),
			metadata: {
				description: localize2('mcp.installFromManifest.description', "Install an MCP server from a JSON manifest file"),
			},
			category,
			f1: true,
			precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		return instantiationService.createInstance(McpInstallFromManifestCommand).run();
	}
}


export class RemoveStoredInput extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.RemoveStoredInput,
			title: localize2('mcp.resetCachedTools', "Reset Cached Tools"),
			category,
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, scope: StorageScope, id?: string): void {
		accessor.get(IMcpRegistry).clearSavedInputs(scope, id);
	}
}

export class EditStoredInput extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.EditStoredInput,
			title: localize2('mcp.editStoredInput', "Edit Stored Input"),
			category,
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, inputId: string, uri: URI | undefined, configSection: string, target: ConfigurationTarget): void {
		const workspaceFolder = uri && accessor.get(IWorkspaceContextService).getWorkspaceFolder(uri);
		accessor.get(IMcpRegistry).editSavedInput(inputId, workspaceFolder || undefined, configSection, target);
	}
}

export class SetOAuthClientSecret extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.SetOAuthClientSecret,
			title: localize2('mcp.setOAuthClientSecret', "Set OAuth Client Secret"),
			category,
			f1: false,
		});
	}

	async run(accessor: ServicesAccessor, clientId: string, mcpServerUrl: string, serverName: string): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const secretStorageService = accessor.get(ISecretStorageService);

		const key = mcpOAuthClientSecretStorageKey(mcpServerUrl, clientId);
		const existing = await secretStorageService.get(key);

		const deleteButton = {
			iconClass: ThemeIcon.asClassName(Codicon.trash),
			tooltip: localize('mcp.setOAuthClientSecret.delete', "Delete stored client secret"),
		};
		const revealButton = {
			iconClass: ThemeIcon.asClassName(Codicon.eye),
			tooltip: localize('mcp.setOAuthClientSecret.reveal', "Show client secret"),
		};
		const hideButton = {
			iconClass: ThemeIcon.asClassName(Codicon.eyeClosed),
			tooltip: localize('mcp.setOAuthClientSecret.hide', "Hide client secret"),
		};

		const result = await new Promise<{ kind: 'accept'; value: string } | { kind: 'delete' } | undefined>(resolve => {
			const input = quickInputService.createInputBox();
			input.title = existing
				? localize('mcp.setOAuthClientSecret.title.replace', "Replace Client Secret for {0}", serverName)
				: localize('mcp.setOAuthClientSecret.title.set', "Set Client Secret for {0}", serverName);
			input.prompt = localize('mcp.setOAuthClientSecret.prompt', "Enter the client secret for OAuth client '{0}'.", clientId);
			input.placeholder = existing
				? localize('mcp.setOAuthClientSecret.placeholder.replace', "Enter a new client secret to replace the stored value")
				: localize('mcp.setOAuthClientSecret.placeholder.set', "Enter client secret");
			input.password = true;
			input.ignoreFocusOut = true;
			if (existing) {
				input.value = existing;
				input.valueSelection = [0, existing.length];
			}
			const updateButtons = () => {
				const toggleButton = input.password ? revealButton : hideButton;
				input.buttons = existing ? [toggleButton, deleteButton] : [toggleButton];
			};
			updateButtons();
			const disposables = new DisposableStore();
			disposables.add(input.onDidAccept(() => {
				const value = input.value;
				if (value.length === 0) {
					// Empty value: treat as a delete (same as the trash button)
					resolve({ kind: 'delete' });
					input.hide();
					return;
				}
				resolve({ kind: 'accept', value });
				input.hide();
			}));
			disposables.add(input.onDidTriggerButton(btn => {
				if (btn === deleteButton) {
					resolve({ kind: 'delete' });
					input.hide();
				} else if (btn === revealButton || btn === hideButton) {
					input.password = !input.password;
					updateButtons();
				}
			}));
			disposables.add(input.onDidHide(() => {
				resolve(undefined);
				disposables.dispose();
				input.dispose();
			}));
			input.show();
		});

		if (!result) {
			return; // cancelled
		}

		if (result.kind === 'delete') {
			await secretStorageService.delete(key);
		} else {
			await secretStorageService.set(key, result.value);
		}
	}
}

export class ShowConfiguration extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ShowConfiguration,
			title: localize2('mcp.command.showConfiguration', "Show Configuration"),
			category,
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, collectionId: string, serverId: string): void {
		const collection = accessor.get(IMcpRegistry).collections.get().find(c => c.id === collectionId);
		if (!collection) {
			return;
		}

		const server = collection?.serverDefinitions.get().find(s => s.id === serverId);
		const editorService = accessor.get(IEditorService);
		if (server?.presentation?.origin) {
			editorService.openEditor({
				resource: server.presentation.origin.uri,
				options: { selection: server.presentation.origin.range }
			});
		} else if (collection.presentation?.origin) {
			editorService.openEditor({
				resource: collection.presentation.origin,
			});
		}
	}
}

export class ShowOutput extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ShowOutput,
			title: localize2('mcp.command.showOutput', "Show Output"),
			category,
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, serverId: string): void {
		accessor.get(IMcpService).servers.get().find(s => s.definition.id === serverId)?.showOutput();
	}
}

interface IAgentHostMcpServerCommandArg {
	readonly agentHostSession: URI;
	readonly serverId: string;
}

export class RestartServer extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.RestartServer,
			title: localize2('mcp.command.restartServer', "Restart Server"),
			category,
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor, _serverId: string | IAgentHostMcpServerCommandArg, _opts?: IMcpServerStartOpts) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class StartServer extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.StartServer,
			title: localize2('mcp.command.startServer', "Start Server"),
			category,
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor, _serverId: string | IAgentHostMcpServerCommandArg, _opts?: IMcpServerStartOpts & { waitForLiveTools?: boolean }) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class StopServer extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.StopServer,
			title: localize2('mcp.command.stopServer', "Stop Server"),
			category,
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor, _serverId: string | IAgentHostMcpServerCommandArg) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class McpBrowseCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.Browse,
			title: localize2('mcp.command.browse', "MCP Servers"),
			tooltip: localize2('mcp.command.browse.tooltip', "Browse MCP Servers"),
			category,
			icon: Codicon.search,
			precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
		});
	}

	async run(_accessor: ServicesAccessor) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class McpBrowsePageCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.BrowsePage,
			title: localize2('mcp.command.browse', "MCP Servers"),
			tooltip: localize2('mcp.command.browse.tooltip', "Browse MCP Servers"),
			category,
			icon: Codicon.search,
			precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
			menu: [{
				id: extensionsFilterSubMenu,
				group: '1_predefined',
				order: 1,
				when: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
			}, {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', InstalledMcpServersViewId), ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
				group: 'navigation',
			}],
		});
	}

	async run(_accessor: ServicesAccessor) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: McpCommandIds.Browse,
		title: localize2('mcp.command.browse.mcp', "Browse MCP Servers"),
		category,
		precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
	},
});

export class ShowInstalledMcpServersCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ShowInstalled,
			title: localize2('mcp.command.show.installed', "Show Installed Servers"),
			category,
			precondition: ContextKeyExpr.and(HasInstalledMcpServersContext, ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
			f1: true,
		});
	}

	async run(_accessor: ServicesAccessor) {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

async function openMcpConfigurationFile(fileService: IFileService, editorService: IEditorService, resource: URI, emptyConfiguration: object): Promise<void> {
	if (!(await fileService.exists(resource))) {
		await fileService.createFile(resource, VSBuffer.fromString(JSON.stringify(emptyConfiguration, null, '\t')));
	}
	await editorService.openEditor({ resource });
}

const emptyVscodeMcpConfiguration = { servers: {} };
const emptyCopilotGlobalMcpConfiguration = { mcpServers: {} };

/** Options accepted by {@link McpCommandIds.OpenUserMcp}. */
export interface IOpenUserMcpConfigurationOptions {
	/** Opens VS Code's user `mcp.json` directly instead of offering every user configuration. */
	readonly legacy?: boolean;
}

export class OpenUserMcpResourceCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.OpenUserMcp,
			title: localize2('mcp.command.openUserMcp', "Open User Configuration"),
			category,
			f1: true,
			precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
		});
	}

	async run(accessor: ServicesAccessor, options?: IOpenUserMcpConfigurationOptions): Promise<void> {
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const quickInputService = accessor.get(IQuickInputService);
		const labelService = accessor.get(ILabelService);
		const commandService = accessor.get(ICommandService);
		const copilotGlobalConfigurationService = accessor.get(IMcpCopilotGlobalConfigurationService);
		const legacyResource = accessor.get(IUserDataProfileService).currentProfile.mcpResource;

		const copilotGlobalResource = options?.legacy ? undefined : await copilotGlobalConfigurationService.getConfigurationResource();
		if (!copilotGlobalResource) {
			await openMcpConfigurationFile(fileService, editorService, legacyResource, emptyVscodeMcpConfiguration);
			return;
		}

		const [hasCopilotGlobal, hasLegacy] = await Promise.all([fileService.exists(copilotGlobalResource), fileService.exists(legacyResource)]);
		type UserConfigurationItem = IQuickPickItem & { readonly configuration?: { readonly resource: URI; readonly empty: object } };
		const items: (UserConfigurationItem | IQuickPickSeparator)[] = [{
			label: localize('mcp.userConfig.copilotGlobal', "Copilot Global"),
			description: hasCopilotGlobal ? localize('mcp.userConfig.recommended', "Recommended") : localize('mcp.userConfig.recommendedNotExisting', "Recommended, not existing"),
			detail: basename(copilotGlobalResource),
			tooltip: labelService.getUriLabel(copilotGlobalResource),
			configuration: { resource: copilotGlobalResource, empty: emptyCopilotGlobalMcpConfiguration },
		}];
		// The legacy file is only offered when it already exists, so new configuration goes to Copilot Global.
		if (hasLegacy) {
			items.push({
				label: localize('mcp.userConfig.vscode', "VS Code User Configuration"),
				description: localize('mcp.userConfig.legacy', "Legacy"),
				detail: basename(legacyResource),
				tooltip: labelService.getUriLabel(legacyResource),
				configuration: { resource: legacyResource, empty: emptyVscodeMcpConfiguration },
			});
		}
		items.push({
			type: 'separator',
		}, {
			label: localize('mcp.userConfig.openCustomizations', "Open MCP Customizations"),
			iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
		});

		const selected = await quickInputService.pick(items, {
			title: localize('mcp.userConfig.title', "Open User MCP Configuration"),
			placeHolder: localize('mcp.userConfig.placeholder', "Select the configuration to open"),
			matchOnDescription: true,
			matchOnDetail: true,
		});
		if (!selected) {
			return;
		}
		if (!selected.configuration) {
			await commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.McpServers);
			return;
		}
		await openMcpConfigurationFile(fileService, editorService, selected.configuration.resource, selected.configuration.empty);
	}
}

export class OpenRemoteUserMcpResourceCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.OpenRemoteUserMcp,
			title: localize2('mcp.command.openRemoteUserMcp', "Open Remote User Configuration"),
			category,
			f1: true,
			precondition: ContextKeyExpr.and(
				ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
				RemoteNameContext.notEqualsTo('')
			)
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const quickInputService = accessor.get(IQuickInputService);
		const labelService = accessor.get(ILabelService);
		const copilotGlobalConfigurationService = accessor.get(IMcpCopilotGlobalConfigurationService);
		const remoteProfile = await accessor.get(IRemoteUserDataProfilesService).getRemoteProfile(accessor.get(IUserDataProfileService).currentProfile);
		const vscodeResource = remoteProfile.mcpResource;

		// The service resolves against the connected remote's home directory, never the local one.
		const copilotResource = await copilotGlobalConfigurationService.getConfigurationResource();
		if (!copilotResource) {
			await openMcpConfigurationFile(fileService, editorService, vscodeResource, emptyVscodeMcpConfiguration);
			return;
		}

		const [hasCopilot, hasVscode] = await Promise.all([fileService.exists(copilotResource), fileService.exists(vscodeResource)]);
		// The VS Code file is only offered when it already exists, so new configuration goes to Copilot; with nothing else to choose from, open it directly.
		if (!hasVscode) {
			await openMcpConfigurationFile(fileService, editorService, copilotResource, emptyCopilotGlobalMcpConfiguration);
			return;
		}

		type RemoteConfigurationItem = IQuickPickItem & { readonly configuration: { readonly resource: URI; readonly empty: object } };
		const items: RemoteConfigurationItem[] = [{
			label: localize('mcp.remoteUserConfig.copilot', "Copilot Remote Configuration"),
			description: hasCopilot ? localize('mcp.remoteUserConfig.recommended', "Recommended") : localize('mcp.remoteUserConfig.recommendedNotExisting', "Recommended, not existing"),
			detail: labelService.getUriLabel(copilotResource),
			tooltip: labelService.getUriLabel(copilotResource),
			configuration: { resource: copilotResource, empty: emptyCopilotGlobalMcpConfiguration },
		}, {
			label: localize('mcp.remoteUserConfig.vscode', "VS Code Remote User Configuration"),
			description: localize('mcp.remoteUserConfig.vscodeProfile', "VS Code profile"),
			detail: labelService.getUriLabel(vscodeResource),
			tooltip: labelService.getUriLabel(vscodeResource),
			configuration: { resource: vscodeResource, empty: emptyVscodeMcpConfiguration },
		}];

		const selected = await quickInputService.pick(items, {
			title: localize('mcp.remoteUserConfig.title', "Open Remote User MCP Configuration"),
			placeHolder: localize('mcp.remoteUserConfig.placeholder', "Select the remote configuration to open"),
			matchOnDescription: true,
			matchOnDetail: true,
		});
		if (selected) {
			await openMcpConfigurationFile(fileService, editorService, selected.configuration.resource, selected.configuration.empty);
		}
	}
}

export class OpenWorkspaceFolderMcpResourceCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.OpenWorkspaceFolderMcp,
			title: localize2('mcp.command.openWorkspaceFolderMcp', "Open Workspace Folder MCP Configuration"),
			category,
			f1: true,
			precondition: ContextKeyExpr.and(
				ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
				WorkspaceFolderCountContext.notEqualsTo(0)
			)
		});
	}

	async run(accessor: ServicesAccessor) {
		const workspaceContextService = accessor.get(IWorkspaceContextService);
		const commandService = accessor.get(ICommandService);
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const workspaceFolders = workspaceContextService.getWorkspace().folders;
		const workspaceFolder = workspaceFolders.length === 1 ? workspaceFolders[0] : await commandService.executeCommand<IWorkspaceFolder>(PICK_WORKSPACE_FOLDER_COMMAND_ID);
		if (workspaceFolder) {
			const resource = await instantiationService.createInstance(McpConfigurationDestination).selectForOpen(workspaceFolder);
			if (resource) {
				await editorService.openEditor({ resource });
			}
		}
	}
}

export class OpenWorkspaceMcpResourceCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.OpenWorkspaceMcp,
			title: localize2('mcp.command.openWorkspaceMcp', "Open Workspace MCP Configuration"),
			category,
			f1: true,
			precondition: ContextKeyExpr.and(
				ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
				WorkbenchStateContext.isEqualTo('workspace')
			)
		});
	}

	async run(accessor: ServicesAccessor) {
		const workspaceContextService = accessor.get(IWorkspaceContextService);
		const editorService = accessor.get(IEditorService);
		const workspaceConfiguration = workspaceContextService.getWorkspace().configuration;
		if (workspaceConfiguration) {
			await editorService.openEditor({ resource: workspaceConfiguration });
		}
	}
}

export class McpBrowseResourcesCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.BrowseResources,
			title: localize2('mcp.browseResources', "Browse Resources..."),
			category,
			precondition: ContextKeyExpr.and(McpContextKeys.serverCount.greater(0), ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
			f1: true,
		});
	}

	run(_accessor: ServicesAccessor, _server?: IMcpServer): void {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class McpConfigureSamplingModels extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.ConfigureSamplingModels,
			title: localize2('mcp.configureSamplingModels', "Configure SamplingModel"),
			category,
		});
	}

	async run(_accessor: ServicesAccessor, _server: IMcpServer): Promise<number> {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class McpStartPromptingServerCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.StartPromptForServer,
			title: localize2('mcp.startPromptingServer', "Start Prompting Server"),
			category,
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor, _server: IMcpServer): Promise<void> {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}

export class McpSkipCurrentAutostartCommand extends Action2 {
	constructor() {
		super({
			id: McpCommandIds.SkipCurrentAutostart,
			title: localize2('mcp.skipCurrentAutostart', "Skip Current Autostart"),
			category,
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor): Promise<void> {
		throw new Error(localize('mcpCommand.unavailable', 'MCP commands are unavailable in this distribution.'));
	}
}
