/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ThemeIcon } from '../../../../../base/common/themables.js';
import { LanguageSelector } from '../../../../../editor/common/languageSelector.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatContextItem, IChatExplicitContextProvider, IChatResourceContextProvider, IChatWorkspaceContextProvider } from '../../common/contextContrib/chatContext.js';
import { IChatRequestWorkspaceVariableEntry, StringChatContextValue } from '../../common/attachments/chatVariableEntries.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';

export const IChatContextService = createDecorator<IChatContextService>('chatContextService');
export interface IChatContextService extends ChatContextService { }
export type ChatTabSelector = { uri: LanguageSelector } | { viewType: string };

/** Compatibility service; AI context providers never activate or collect workspace content. */
export class ChatContextService extends Disposable {
	declare readonly _serviceBrand: undefined;

	setExecuteCommandCallback(_callback: (itemHandle: number) => Promise<void>): void { }

	async executeChatContextItemCommand(_handle: number): Promise<void> { }

	setChatContextProvider(_id: string, _picker: { title: string; icon: ThemeIcon }): void { }

	registerChatWorkspaceContextProvider(_id: string, _provider: IChatWorkspaceContextProvider): void { }

	registerChatExplicitContextProvider(_id: string, _provider: IChatExplicitContextProvider): void { }

	registerChatResourceContextProvider(_id: string, _selector: ChatTabSelector, _provider: IChatResourceContextProvider): void { }

	unregisterChatContextProvider(_id: string): void { }

	updateWorkspaceContextItems(_id: string, _items: IChatContextItem[]): void { }

	getWorkspaceContextItems(): IChatRequestWorkspaceVariableEntry[] {
		return [];
	}

	async contextForResource(_uri: URI, _language?: string, _viewType?: string): Promise<StringChatContextValue | undefined> {
		return undefined;
	}

	async resolveChatContext(context: StringChatContextValue, _language?: string): Promise<StringChatContextValue> {
		return context;
	}
}

registerSingleton(IChatContextService, ChatContextService, InstantiationType.Delayed);
