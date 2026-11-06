/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IChatTipService = createDecorator<IChatTipService>('chatTipService');

export interface IChatTip {
	readonly id: string;
	readonly content: MarkdownString;
	readonly enabledCommands?: readonly string[];
	readonly icon?: URI;
}

export interface IChatTipProvider {
	readonly onDidChange: Event<void>;
	provideTip(): IChatTip | undefined;
	dismissTip(tipId: string): void;
	resetSession?(): void;
	clearDismissedTips?(): void;
	hasMultipleTips?(): boolean;
	navigateTip?(direction: 1 | -1): IChatTip | undefined;
}

export interface IChatTipService {
	readonly _serviceBrand: undefined;

	/**
	 * Fired when the current tip is dismissed.
	 */
	readonly onDidDismissTip: Event<void>;

	/**
	 * Fired when the user navigates to a different tip (previous/next).
	 */
	readonly onDidNavigateTip: Event<IChatTip>;

	/**
	 * Fired when the tip widget is hidden without dismissing the tip.
	 */
	readonly onDidHideTip: Event<void>;

	/**
	 * Fired when tips are disabled.
	 */
	readonly onDidDisableTips: Event<void>;
	readonly onDidChangeTip: Event<void>;

	registerTipProvider(provider: IChatTipProvider): IDisposable;

	/**
	 * Gets a tip to show on the welcome/getting-started view.
	 * Returns the same tip on repeated calls for stable rerenders.
	 */
	getWelcomeTip(contextKeyService: IContextKeyService): IChatTip | undefined;

	/**
	 * Resets tip state for a new conversation.
	 * Call this when the chat widget binds to a new model.
	 */
	resetSession(): void;

	/**
	 * Dismisses the current tip and allows a new one to be picked for the same request.
	 * The dismissed tip will not be shown again for this user on this application installation.
	 */
	dismissTip(): void;

	/**
	 * Dismisses the current tip and hides all tips for the rest of the current chat session.
	 */
	dismissTipForSession(): void;

	/**
	 * Hides the tip widget without permanently dismissing the tip.
	 * The tip may be shown again in a future session.
	 */
	hideTip(): void;

	/**
	 * Hides all tips for the rest of the current chat session.
	 */
	hideTipsForSession(): void;

	/**
	 * Disables tips permanently by setting the `chat.tips.enabled` configuration to false.
	 */
	disableTips(): Promise<void>;

	/**
	 * Navigates to the next tip in the catalog without permanently dismissing the current one.
	 */
	navigateToNextTip(): IChatTip | undefined;

	/**
	 * Navigates to the previous tip in the catalog without permanently dismissing the current one.
	 */
	navigateToPreviousTip(): IChatTip | undefined;

	/**
	 * Gets the next eligible tip after the current one, without requiring multiple tips.
	 * Used after dismissing a tip to show the next available tip (even if it's the only one left).
	 */
	getNextEligibleTip(): IChatTip | undefined;

	/**
	 * Returns whether there are multiple eligible tips for navigation.
	 */
	hasMultipleTips(): boolean;

	/**
	 * Records usage of a slash command to update tip eligibility for flows where
	 * the slash command text is transformed before request submission.
	 */
	recordSlashCommandUsage(command: string): void;

	/**
	 * Clears all dismissed tips so they can be shown again.
	 */
	clearDismissedTips(): void;
}

/** Compatibility boundary: built-in chat tips and usage tracking are disabled. */
export class ChatTipService extends Disposable implements IChatTipService {
	declare readonly _serviceBrand: undefined;
	readonly onDidDismissTip: Event<void> = Event.None;
	readonly onDidNavigateTip: Event<IChatTip> = Event.None;
	readonly onDidHideTip: Event<void> = Event.None;
	readonly onDidDisableTips: Event<void> = Event.None;
	readonly onDidChangeTip: Event<void> = Event.None;

	registerTipProvider(_provider: IChatTipProvider): IDisposable { return Disposable.None; }
	getWelcomeTip(_contextKeyService: IContextKeyService): IChatTip | undefined { return undefined; }
	resetSession(): void { }
	dismissTip(): void { }
	dismissTipForSession(): void { }
	hideTip(): void { }
	hideTipsForSession(): void { }
	async disableTips(): Promise<void> { }
	navigateToNextTip(): IChatTip | undefined { return undefined; }
	navigateToPreviousTip(): IChatTip | undefined { return undefined; }
	getNextEligibleTip(): IChatTip | undefined { return undefined; }
	hasMultipleTips(): boolean { return false; }
	recordSlashCommandUsage(_command: string): void { }
	clearDismissedTips(): void { }
}
