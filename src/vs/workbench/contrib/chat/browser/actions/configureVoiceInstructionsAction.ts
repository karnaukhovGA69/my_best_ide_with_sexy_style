/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID = 'workbench.action.chat.configureVoiceInstructions';
export const CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID = 'workbench.action.chat.configureDictationInstructions';

/** Voice instructions are unavailable; do not register commands that create configuration files. */
export function registerConfigureSpeechInstructionsActions(): void { }
