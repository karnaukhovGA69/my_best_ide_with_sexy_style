/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAction } from '../../../../../base/common/actions.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';

export const SELECT_MICROPHONE_COMMAND = 'workbench.action.chat.selectSpeechToTextMicrophone';
export const SHOW_VOICE_MODE_ONBOARDING_COMMAND = 'agentsVoice.showOnboarding';

/** Dictation is unavailable in this distribution; do not offer configuration or activation actions. */
export function getDictationContextMenuActions(_commandService: ICommandService, _configurationService: IConfigurationService, _keybindingService: IKeybindingService, _keybindingCommandId: string): IAction[] {
	return [];
}

/** Voice mode is unavailable in this distribution. */
export function getVoiceModeContextMenuActions(_commandService: ICommandService, _configurationService: IConfigurationService, _keybindingService: IKeybindingService, _keybindingCommandId: string): IAction[] {
	return [];
}

/** Leave the host's normal context menu handling intact. */
export function addMicButtonContextMenuListener(_container: HTMLElement, _getActions: () => IAction[], _contextMenuService: IContextMenuService): IDisposable {
	return Disposable.None;
}
