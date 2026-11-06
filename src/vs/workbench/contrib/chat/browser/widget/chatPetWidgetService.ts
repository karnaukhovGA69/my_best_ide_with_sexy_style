/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, IObservable } from '../../../../../base/common/observable.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import type { IChatPetWidgetHost } from './chatPetWidget.js';
import type { ChatPetJumpGame } from './chatPetJumpGame.js';

export const IChatPetWidgetService = createDecorator<IChatPetWidgetService>('chatPetWidgetService');

export interface IChatPetWidgetHostRegistration extends IDisposable {
	readonly active: IObservable<boolean>;
}

export interface IChatPetWidgetService {
	readonly _serviceBrand: undefined;
	register(owner: object, host: IChatPetWidgetHost, preferred?: IObservable<boolean>, onDidFocus?: Event<void>): IChatPetWidgetHostRegistration;
	getFocusedJumpGame(): ChatPetJumpGame | undefined;
}

/** Compatibility boundary for callers retained while built-in chat is removed. */
export class ChatPetWidgetService extends Disposable implements IChatPetWidgetService {
	declare readonly _serviceBrand: undefined;

	register(_owner: object, _host: IChatPetWidgetHost, _preferred?: IObservable<boolean>, _onDidFocus?: Event<void>): IChatPetWidgetHostRegistration {
		return { active: constObservable(false), dispose: () => {} };
	}

	getFocusedJumpGame(): ChatPetJumpGame | undefined {
		return undefined;
	}
}
