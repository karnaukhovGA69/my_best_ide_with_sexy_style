/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { constObservable, IObservable } from '../../../../base/common/observable.js';
import { ContributionEnablementState, IEnablementModel } from '../../chat/common/enablement.js';
import { IAutostartResult, IMcpServer, IMcpService, LazyCollectionState, McpCollectionDefinition } from './mcpTypes.js';

/** Compatibility service without MCP server discovery, construction or startup. */
export class McpService extends Disposable implements IMcpService {
	declare readonly _serviceBrand: undefined;

	public readonly servers: IObservable<readonly IMcpServer[]> = constObservable(Object.freeze([]));
	public readonly enablementModel: IEnablementModel = {
		readEnabled: () => ContributionEnablementState.DisabledProfile,
		readProfileEnabled: () => false,
		canSetEnabled: () => false,
		setEnabled: () => { },
		setDefaultEnabled: () => { },
		remove: () => { },
	};

	public get lazyCollectionState(): IObservable<{ state: LazyCollectionState; collections: McpCollectionDefinition[] }> {
		return constObservable({ state: LazyCollectionState.AllKnown, collections: [] });
	}

	public autostart(_token?: CancellationToken): IObservable<IAutostartResult> {
		return constObservable({ working: false, starting: [], serversRequiringInteraction: [] });
	}

	public cancelAutostart(): void { }

	public resetCaches(): void { }

	public resetTrust(): void { }

	public async activateCollections(): Promise<void> { }

	public updateCollectedServers(): void { }
}
