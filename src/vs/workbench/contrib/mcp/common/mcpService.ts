/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { constObservable, derived, IObservable } from '../../../../base/common/observable.js';
import { CollisionEnablementModel, ContributionEnablementState, EnablementModel, IEnablementModel } from '../../chat/common/enablement.js';
import { McpCollisionBehavior } from './mcpConfiguration.js';
import { IMcpRegistry } from './mcpRegistryTypes.js';
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

/**
 * Wraps an {@link EnablementModel} with collision-aware defaults and
 * mutual-exclusion logic for MCP servers with the same label.
 *
 * When collision behavior is `disable`:
 * - Servers whose label collides with a higher-priority server are disabled
 *   by default (unless the user has explicitly toggled them).
 * - Enabling a colliding server disables all other servers with the same label.
 *
 * When collision behavior is `suffix`, delegates everything unchanged.
 */
export class McpCollisionEnablementModel extends CollisionEnablementModel {

	/**
	 * For each server definition ID, the list of all definition IDs that share
	 * the same (case-insensitive) label, in priority order (lowest collection
	 * order first). Empty when collision behavior is `suffix`.
	 */
	constructor(
		base: EnablementModel,
		registry: IMcpRegistry,
		collisionBehavior: IObservable<McpCollisionBehavior>,
	) {
		const collisionGroups = derived(reader => {
			if (collisionBehavior.read(reader) !== McpCollisionBehavior.Disable) {
				return new Map<string, string[]>();
			}

			const collections = registry.collections.read(reader);
			// label → list of server definition IDs, in priority order
			const labelToIds = new Map<string, string[]>();
			for (const collection of collections) {
				for (const server of collection.serverDefinitions.read(reader)) {
					const key = server.label.toLowerCase();
					let ids = labelToIds.get(key);
					if (!ids) {
						ids = [];
						labelToIds.set(key, ids);
					}
					ids.push(server.id);
				}
			}

			const groups = new Map<string, string[]>();
			for (const ids of labelToIds.values()) {
				if (ids.length < 2) {
					continue;
				}
				for (const id of ids) {
					groups.set(id, ids);
				}
			}

			return groups;
		});
		super(base, collisionGroups);
	}
}
