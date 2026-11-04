/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IOnboardingService } from '../common/onboardingService.js';

// Keep the startup-page service contract without bundling the Copilot onboarding UI.
class DisabledOnboardingService implements IOnboardingService {
	declare readonly _serviceBrand: undefined;
	readonly onDidDismiss = Event.None;
	show(): void { }
}

registerSingleton(IOnboardingService, DisabledOnboardingService, InstantiationType.Delayed);
