/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IChatInputOnboardingBanner, IChatInputOnboardingHostOptions } from '../../chat/browser/widget/input/chatInputOnboarding.js';

export interface IVoiceModeOnboardingBannerOptions {
	/** The element the banner attaches itself to. */
	readonly container: HTMLElement;
	readonly onDismiss: () => void;
	readonly source: 'automatic' | 'manual';
	/** Allows tests to provide a deterministic media element. */
	readonly audioFactory?: () => HTMLAudioElement;
	/** Allows tests to provide a deterministic spoken language. */
	readonly voiceLanguage?: string;
}

/** Compatibility banner: voice onboarding is unavailable and creates no DOM or audio. */
export class VoiceModeOnboardingBanner extends Disposable implements IChatInputOnboardingBanner {
	constructor(_options: IVoiceModeOnboardingBannerOptions) { super(); }

	hasFocus(): boolean { return false; }
	canFocus(): boolean { return false; }
	focus(): void { }
	announce(): void { }
	setVisible(_visible: boolean): void { }
}

export const IVoiceModeOnboardingService = createDecorator<IVoiceModeOnboardingService>('voiceModeOnboardingService');

export interface IVoiceModeOnboardingService {
	readonly _serviceBrand: undefined;
	readonly isVisible: boolean;

	/**
	 * Register a container that can host the banner (a chat input). The most
	 * recently focused host wins when the banner is shown.
	 */
	registerHost(options: IChatInputOnboardingHostOptions): IDisposable;

	/**
	 * Show the introduction if the user has never seen it. Marks it as seen on
	 * the first successful show, so it never appears again.
	 */
	showIfNeeded(): void;

	/** Show the introduction again regardless of whether it has been seen. */
	show(): boolean;
}

/** Compatibility service: registration and display of voice onboarding are disabled. */
export class VoiceModeOnboardingService extends Disposable implements IVoiceModeOnboardingService {
	declare readonly _serviceBrand: undefined;
	readonly isVisible = false;

	registerHost(_options: IChatInputOnboardingHostOptions): IDisposable {
		return Disposable.None;
	}

	showIfNeeded(): void { }
	show(): boolean { return false; }
}

registerSingleton(IVoiceModeOnboardingService, VoiceModeOnboardingService, InstantiationType.Delayed);
