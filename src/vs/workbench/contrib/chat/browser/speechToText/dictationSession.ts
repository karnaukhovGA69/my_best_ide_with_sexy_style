/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatDictationSurface, IChatSpeechToTextService } from './chatSpeechToTextService.js';

/** Dictation is unavailable; no editor can acquire a session. */
export const onDidChangeDictationEditor: Event<void> = Event.None;

export function isDictating(): boolean { return false; }
export function activeDictationEditor(): ICodeEditor | undefined { return undefined; }
export function isDictationActiveForEditor(_editor: ICodeEditor): boolean { return false; }

/** Compatibility entry point without recording, editor edits, subscriptions or timers. */
export async function startDictation(_service: IChatSpeechToTextService, _editor: ICodeEditor, _window: Window & typeof globalThis, _logService: ILogService, _surface: ChatDictationSurface = 'chat'): Promise<void> { }
export async function stopDictation(): Promise<void> { }
export async function stopDictationForEditor(_editor: ICodeEditor): Promise<void> { }
export function cancelDictation(): void { }
export function notifyDictationSubmitted(_editor: ICodeEditor): void { }
