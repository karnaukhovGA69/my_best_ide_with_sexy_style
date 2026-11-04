/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInlineChatSessionService } from './inlineChatSessionService.js';
import { IInlineChatSessionResolver } from './inlineChatSessionResolver.js';
import { UnavailableInlineChatSessionService, UnavailableInlineChatSessionResolver } from './unavailableInlineChat.js';

// Keep dependency contracts for shared workbench code without creating AI sessions,
// editor controllers, notebook listeners, actions or model-selection contributions.
registerSingleton(IInlineChatSessionService, UnavailableInlineChatSessionService, InstantiationType.Delayed);
registerSingleton(IInlineChatSessionResolver, UnavailableInlineChatSessionResolver, InstantiationType.Delayed);
