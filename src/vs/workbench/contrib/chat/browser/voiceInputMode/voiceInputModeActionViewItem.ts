/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseActionViewItem } from '../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IAction } from '../../../../../base/common/actions.js';
import { IObservable } from '../../../../../base/common/observable.js';
import { localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IVoiceInputModeService, VoiceInputMode } from './voiceInputMode.js';

export class ChatVoiceInputModeAction extends Action2 {
	static readonly ID = 'workbench.action.chat.voiceInputMode';

	constructor() {
		super({
			id: ChatVoiceInputModeAction.ID,
			title: localize2('voiceInputMode', "Voice Input Mode"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	run(_accessor: ServicesAccessor): void { }
}

export class ChatVoiceInputModeToggleListenAction extends Action2 {
	static readonly ID = 'workbench.action.chat.voiceInputMode.holdToTalk';

	constructor() {
		super({
			id: ChatVoiceInputModeToggleListenAction.ID,
			title: localize2('voiceInputMode.holdToTalk', "Voice Mode: Hold to Talk"),
			precondition: ContextKeyExpr.false(),
			f1: false,
		});
	}

	async run(_accessor: ServicesAccessor): Promise<void> { }
}

export function registerVoiceInputModeSimulateActions(): void { }

export interface IVoiceInputModePillOptions {
	/** Toggle dictation for the host surface (defaults to the shared toggle command). */
	readonly toggleDictation?: () => void;
	/** Whether this is the focused or last-focused chat input that owns live state. */
	readonly isActive?: IObservable<boolean>;
	/** Whether the dictation session belongs to this input. Defaults to `isActive`. */
	readonly isDictationActive?: IObservable<boolean>;
	/** Whether the shared Voice Mode transport belongs to this input. */
	readonly isVoiceActive?: IObservable<boolean>;
}

/** Inactive action view: preserve the host container without rendering voice controls. */
export class VoiceInputModeActionViewItem extends BaseActionViewItem {
	constructor(action: IAction, _options: IVoiceInputModePillOptions | undefined) {
		super(undefined, action);
	}

	override render(_container: HTMLElement): void { }
	override isEnabled(): boolean { return false; }
	override onClick(): void { }
}

export function isVoiceInputModeAvailable(_voiceInputModeService: IVoiceInputModeService): VoiceInputMode | 'both' | undefined {
	return undefined;
}
