/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { ITerminalChatService } from '../../../terminal/browser/terminal.js';
import { ITerminalChatSessionResolver } from './terminalChatSessionResolver.js';
import { UnavailableTerminalChatService, UnavailableTerminalChatSessionResolver } from './unavailableTerminalChat.js';

// Shared terminal consumers retain their contracts without AI controllers,
// commands, session tracking, stored mappings or agent-enablement listeners.
registerSingleton(ITerminalChatService, UnavailableTerminalChatService, InstantiationType.Delayed);
registerSingleton(ITerminalChatSessionResolver, UnavailableTerminalChatSessionResolver, InstantiationType.Delayed);
