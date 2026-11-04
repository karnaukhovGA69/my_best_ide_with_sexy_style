/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ITerminalChatService, ITerminalInstance } from '../../../terminal/browser/terminal.js';
import { ITerminalChatSessionResolution, ITerminalChatSessionResolver } from './terminalChatSessionResolver.js';

export class UnavailableTerminalChatService implements ITerminalChatService {
	declare readonly _serviceBrand: undefined;
	readonly onDidRegisterTerminalInstanceWithToolSession = Event.None;
	readonly onDidContinueInBackground = Event.None;

	registerTerminalInstanceWithToolSession(): void { }
	async getTerminalInstanceByToolSessionId(): Promise<undefined> { return undefined; }
	registerTerminalInstanceWithExecutionId(): IDisposable { return Disposable.None; }
	getTerminalInstanceByExecutionId(): undefined { return undefined; }
	getToolSessionTerminalInstances(): readonly ITerminalInstance[] { return []; }
	getToolSessionIdForInstance(): undefined { return undefined; }
	registerTerminalInstanceWithChatSession(): void { }
	getChatSessionResourceForInstance(): undefined { return undefined; }
	isBackgroundTerminal(): boolean { return false; }
	registerOutputSource(): IDisposable { return Disposable.None; }
	getOutputSource(): undefined { return undefined; }
	registerProgressPart(): IDisposable { return Disposable.None; }
	setFocusedProgressPart(): void { }
	clearFocusedProgressPart(): void { }
	getFocusedProgressPart(): undefined { return undefined; }
	getMostRecentProgressPart(): undefined { return undefined; }
	setChatSessionAutoApproval(): void { }
	hasChatSessionAutoApproval(): boolean { return false; }
	addSessionAutoApproveRule(): void { }
	getSessionAutoApproveRules(): Readonly<Record<string, boolean | { approve: boolean; matchCommandLine?: boolean }>> { return {}; }
	continueInBackground(): void { }
	registerAhpCommandSource(): IDisposable { return Disposable.None; }
	getAhpCommandSource(): undefined { return undefined; }
}

export class UnavailableTerminalChatSessionResolver implements ITerminalChatSessionResolver {
	declare readonly _serviceBrand: undefined;

	async resolve(): Promise<ITerminalChatSessionResolution | undefined> {
		return undefined;
	}
}
