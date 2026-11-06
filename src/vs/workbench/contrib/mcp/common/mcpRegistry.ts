/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { constObservable, IObservable } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { StorageScope } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceFolderData } from '../../../../platform/workspace/common/workspace.js';
import { IResolvedValue } from '../../../services/configurationResolver/common/configurationResolverExpression.js';
import { IMcpHostDelegate, IMcpRegistry, IMcpResolveConnectionOptions } from './mcpRegistryTypes.js';
import { IMcpServerConnection, LazyCollectionState, McpCollectionDefinition, McpDefinitionReference, McpServerDefinition } from './mcpTypes.js';

/** Compatibility registry without MCP discovery, input storage or connection resolution. */
export class McpRegistry extends Disposable implements IMcpRegistry {
	declare readonly _serviceBrand: undefined;

	public readonly onDidChangeInputs = Event.None;
	public readonly collections: IObservable<readonly McpCollectionDefinition[]> = constObservable(Object.freeze([]));
	public readonly delegates: IObservable<readonly IMcpHostDelegate[]> = constObservable(Object.freeze([]));

	public get lazyCollectionState(): IObservable<{ state: LazyCollectionState; collections: McpCollectionDefinition[] }> {
		return constObservable({ state: LazyCollectionState.AllKnown, collections: [] });
	}

	public registerDelegate(_delegate: IMcpHostDelegate): IDisposable {
		return Disposable.None;
	}

	public registerCollection(_collection: McpCollectionDefinition): IDisposable {
		return Disposable.None;
	}

	public getServerDefinition(_collectionRef: McpDefinitionReference, _definitionRef: McpDefinitionReference): IObservable<{ server: McpServerDefinition | undefined; collection: McpCollectionDefinition | undefined }> {
		return constObservable({ server: undefined, collection: undefined });
	}

	public async discoverCollections(): Promise<McpCollectionDefinition[]> {
		return [];
	}

	public async clearSavedInputs(_scope: StorageScope, _inputId?: string): Promise<void> {
		throw new Error(localize('mcpInputs.unavailable', 'MCP saved inputs are unavailable in this distribution.'));
	}

	public async editSavedInput(_inputId: string, _folderData: IWorkspaceFolderData | undefined, _configSection: string, _target: ConfigurationTarget): Promise<void> {
		throw new Error(localize('mcpInputs.unavailable', 'MCP saved inputs are unavailable in this distribution.'));
	}

	public async setSavedInput(_inputId: string, _target: ConfigurationTarget, _value: string): Promise<void> {
		throw new Error(localize('mcpInputs.unavailable', 'MCP saved inputs are unavailable in this distribution.'));
	}

	public async getSavedInputs(_scope: StorageScope): Promise<{ [id: string]: IResolvedValue }> {
		return {};
	}

	public async resolveConnection(_options: IMcpResolveConnectionOptions): Promise<IMcpServerConnection | undefined> {
		return undefined;
	}
}
