/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { ContextKeyExpression, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { FileAccess } from '../../../../base/common/network.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { LinkedText, parseLinkedText } from '../../../../base/common/linkedText.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { localize } from '../../../../nls.js';

export const HasMultipleNewFileEntries = new RawContextKey<boolean>('hasMultipleNewFileEntries', false);

export const IWalkthroughsService = createDecorator<IWalkthroughsService>('walkthroughsService');

export const hiddenEntriesConfigurationKey = 'workbench.welcomePage.hiddenCategories';

export const walkthroughMetadataConfigurationKey = 'workbench.welcomePage.walkthroughMetadata';
export type WalkthroughMetaDataType = Map<string, { firstSeen: number; stepIDs: string[]; manaullyOpened: boolean }>;

export interface IWalkthrough {
	id: string;
	title: string;
	description: string;
	order: number;
	source: string;
	isFeatured: boolean;
	next?: string;
	when: ContextKeyExpression;
	steps: IWalkthroughStep[];
	icon:
	| { type: 'icon'; icon: ThemeIcon }
	| { type: 'image'; path: string };
	walkthroughPageTitle: string;
}

export type IWalkthroughLoose = Omit<IWalkthrough, 'steps'> & { steps: (Omit<IWalkthroughStep, 'description'> & { description: string })[] };

export interface IResolvedWalkthrough extends IWalkthrough {
	steps: IResolvedWalkthroughStep[];
	newItems: boolean;
	recencyBonus: number;
	newEntry: boolean;
}

export interface IWalkthroughStep {
	id: string;
	title: string;
	description: LinkedText[];
	category: string;
	when: ContextKeyExpression;
	order: number;
	completionEvents: string[];
	media:
	| { type: 'image'; path: { hcDark: URI; hcLight: URI; light: URI; dark: URI }; altText: string }
	| { type: 'svg'; path: URI; altText: string }
	| { type: 'markdown'; path: URI; base: URI; root: URI }
	| { type: 'video'; path: { hcDark: URI; hcLight: URI; light: URI; dark: URI }; poster?: { hcDark: URI; hcLight: URI; light: URI; dark: URI }; root: URI; altText: string };
}

type StepProgress = { done: boolean };

export interface IResolvedWalkthroughStep extends IWalkthroughStep, StepProgress { }

export interface IWalkthroughsService {
	_serviceBrand: undefined;

	readonly onDidAddWalkthrough: Event<IResolvedWalkthrough>;
	readonly onDidRemoveWalkthrough: Event<string>;
	readonly onDidChangeWalkthrough: Event<IResolvedWalkthrough>;
	readonly onDidProgressStep: Event<IResolvedWalkthroughStep>;

	getWalkthroughs(): IResolvedWalkthrough[];
	getWalkthrough(id: string): IResolvedWalkthrough;

	registerWalkthrough(descriptor: IWalkthroughLoose): void;

	progressByEvent(eventName: string): void;
	progressStep(id: string): void;
	deprogressStep(id: string): void;

	markWalkthroughOpened(id: string): void;
}

/** Compatibility service: walkthrough collection and progress tracking are disabled. */
export class WalkthroughsService extends Disposable implements IWalkthroughsService {
	declare readonly _serviceBrand: undefined;
	readonly onDidAddWalkthrough = Event.None;
	readonly onDidRemoveWalkthrough = Event.None;
	readonly onDidChangeWalkthrough = Event.None;
	readonly onDidProgressStep = Event.None;

	getWalkthroughs(): IResolvedWalkthrough[] { return []; }

	getWalkthrough(_id: string): IResolvedWalkthrough {
		throw new Error(localize('walkthroughsUnavailable', "Walkthroughs are unavailable in Myself IDE."));
	}

	registerWalkthrough(_descriptor: IWalkthroughLoose): void { }
	progressByEvent(_eventName: string): void { }
	progressStep(_id: string): void { }
	deprogressStep(_id: string): void { }
	markWalkthroughOpened(_id: string): void { }
}

export const parseDescription = (desc: string): LinkedText[] => desc.split('\n').filter(x => x).map(text => parseLinkedText(text));

export const convertInternalMediaPathToFileURI = (path: string) => path.startsWith('https://')
	? URI.parse(path, true)
	: FileAccess.asFileUri(`vs/workbench/contrib/welcomeGettingStarted/common/media/${path}`);

registerSingleton(IWalkthroughsService, WalkthroughsService, InstantiationType.Delayed);
