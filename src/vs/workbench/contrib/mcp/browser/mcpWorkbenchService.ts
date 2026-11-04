/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { IMarkdownString, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IIterativePager } from '../../../../base/common/paging.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IMcpGalleryManifest, McpGalleryManifestStatus } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import type { IQueryOptions } from '../../../../platform/mcp/common/mcpManagement.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';
import type { IWorkbenchLocalMcpServer, IWorkbencMcpServerInstallOptions } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { HasInstalledMcpServersContext, IEditableMcpServerConfiguration, IMcpConfigPath, IMcpServerEditorOptions, IMcpWorkbenchService, IWorkbenchMcpServer, McpServersGalleryStatusContext } from '../common/mcpTypes.js';

function disabledMessage(): string {
	return localize('mcp.workbench.disabled', 'MCP management is disabled in Myself IDE.');
}

/** Compatibility facade without MCP inventory, management, URL registration or editor activity. */
export class McpWorkbenchService extends Disposable implements IMcpWorkbenchService {
	declare readonly _serviceBrand: undefined;

	readonly onChange = Event.None;
	readonly onReset = Event.None;
	readonly whenInitialLocalMcpServersLoaded: Promise<void> = Promise.resolve();

	get local(): readonly IWorkbenchMcpServer[] { return []; }

	getEnabledLocalMcpServers(): IWorkbenchLocalMcpServer[] {
		return [];
	}

	async queryLocal(): Promise<IWorkbenchMcpServer[]> {
		return [];
	}

	async queryGallery(_options?: IQueryOptions, _token?: CancellationToken, _manifest?: IMcpGalleryManifest): Promise<IIterativePager<IWorkbenchMcpServer>> {
		return {
			firstPage: { items: [], hasMore: false },
			getNextPage: async () => ({ items: [], hasMore: false }),
		};
	}

	async getMcpServerFromGallery(_name: string, _manifest?: IMcpGalleryManifest): Promise<IWorkbenchMcpServer | undefined> {
		return undefined;
	}

	canInstall(_server: IWorkbenchMcpServer): IMarkdownString {
		return new MarkdownString(disabledMessage());
	}

	async install(_server: IWorkbenchMcpServer, _options?: IWorkbencMcpServerInstallOptions): Promise<IWorkbenchMcpServer> {
		throw new Error(disabledMessage());
	}

	async uninstall(_server: IWorkbenchMcpServer): Promise<void> {
		throw new Error(disabledMessage());
	}

	async resolveEditableMcpServerConfiguration(_source: URI, _name: string): Promise<IEditableMcpServerConfiguration | undefined> {
		return undefined;
	}

	getMcpConfigPath(arg: IWorkbenchLocalMcpServer): IMcpConfigPath | undefined;
	getMcpConfigPath(arg: URI): Promise<IMcpConfigPath | undefined>;
	getMcpConfigPath(arg: URI | IWorkbenchLocalMcpServer): Promise<IMcpConfigPath | undefined> | IMcpConfigPath | undefined {
		return arg instanceof URI ? Promise.resolve(undefined) : undefined;
	}

	async handleURL(_uri: URI): Promise<boolean> {
		return false;
	}

	async openSearch(_searchValue: string, _preserveFocus?: boolean): Promise<void> {
		throw new Error(disabledMessage());
	}

	async open(_server: IWorkbenchMcpServer | string, _options?: IMcpServerEditorOptions): Promise<void> {
		throw new Error(disabledMessage());
	}
}

/** Initializes empty UI state without querying MCP inventory or subscribing to a gallery. */
export class MCPContextsInitialisation extends Disposable implements IWorkbenchContribution {
	static ID = 'workbench.mcp.contexts.initialisation';

	constructor(@IContextKeyService contextKeyService: IContextKeyService) {
		super();
		McpServersGalleryStatusContext.bindTo(contextKeyService).set(McpGalleryManifestStatus.Unavailable);
		HasInstalledMcpServersContext.bindTo(contextKeyService).set(false);
	}
}
