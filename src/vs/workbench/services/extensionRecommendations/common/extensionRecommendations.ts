/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';

export const enum ExtensionRecommendationReason {
	Workspace,
	File,
	Executable,
	WorkspaceConfig,
	DynamicWorkspace,
	Experimental,
	Application,
}

export interface IExtensionRecommendationReason {
	reasonId: ExtensionRecommendationReason;
	reasonText: string;
}

export const IExtensionRecommendationsService = createDecorator<IExtensionRecommendationsService>('extensionRecommendationsService');

export interface IExtensionRecommendationsService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeRecommendations: Event<void>;
	getAllRecommendationsWithReason(): IStringDictionary<IExtensionRecommendationReason>;

	getImportantRecommendations(): Promise<string[]>;
	getOtherRecommendations(): Promise<string[]>;
	getFileBasedRecommendations(): string[];
	getExeBasedRecommendations(exe?: string): Promise<{ important: string[]; others: string[] }>;
	getConfigBasedRecommendations(): Promise<{ important: string[]; others: string[] }>;
	getWorkspaceRecommendations(): Promise<Array<string | URI>>;
	getKeymapRecommendations(): string[];
	getLanguageRecommendations(): string[];
	getRemoteRecommendations(): string[];
}

export type IgnoredRecommendationChangeNotification = {
	extensionId: string;
	isRecommended: boolean;
};

export const IExtensionIgnoredRecommendationsService = createDecorator<IExtensionIgnoredRecommendationsService>('IExtensionIgnoredRecommendationsService');

export interface IExtensionIgnoredRecommendationsService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeIgnoredRecommendations: Event<void>;
	readonly ignoredRecommendations: string[];

	readonly onDidChangeGlobalIgnoredRecommendation: Event<IgnoredRecommendationChangeNotification>;
	readonly globalIgnoredRecommendations: string[];
	toggleGlobalIgnoredRecommendation(extensionId: string, ignore: boolean): void;
}



/** Keeps service consumers compatible without collecting recommendation signals. */
export class NullExtensionRecommendationsService implements IExtensionRecommendationsService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeRecommendations = Event.None;

	getAllRecommendationsWithReason(): IStringDictionary<IExtensionRecommendationReason> { return {}; }
	async getImportantRecommendations(): Promise<string[]> { return []; }
	async getOtherRecommendations(): Promise<string[]> { return []; }
	getFileBasedRecommendations(): string[] { return []; }
	async getExeBasedRecommendations(): Promise<{ important: string[]; others: string[] }> { return { important: [], others: [] }; }
	async getConfigBasedRecommendations(): Promise<{ important: string[]; others: string[] }> { return { important: [], others: [] }; }
	async getWorkspaceRecommendations(): Promise<Array<string | URI>> { return []; }
	getKeymapRecommendations(): string[] { return []; }
	getLanguageRecommendations(): string[] { return []; }
	getRemoteRecommendations(): string[] { return []; }
}
