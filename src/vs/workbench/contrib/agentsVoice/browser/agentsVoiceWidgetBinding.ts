/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { IAgentSessionsService } from '../../chat/browser/agentSessions/agentSessionsService.js';
import { IAgentTitleBarStatusService } from '../../chat/browser/agentSessions/experiments/agentTitleBarStatusService.js';
import { IVoicePlaybackService } from '../../chat/common/voicePlaybackService.js';
import { IVoiceSessionController } from '../../chat/browser/voiceClient/voiceSessionController.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IChatService } from '../../chat/common/chatService/chatService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { AgentsVoiceWidget } from './agentsVoiceWidget.js';

export interface IWidgetBindingServices {
	readonly voiceSessionController: IVoiceSessionController;
	readonly agentSessionsService: IAgentSessionsService;
	readonly agentTitleBarStatusService: IAgentTitleBarStatusService;
	readonly voicePlaybackService: IVoicePlaybackService;
	readonly environmentService: IWorkbenchEnvironmentService;
	readonly chatService?: IChatService;
	readonly configurationService?: IConfigurationService;
}

/** Compatibility binding: disabled voice widgets never subscribe to session data. */
export function bindWidgetToController(_widget: AgentsVoiceWidget, _services: IWidgetBindingServices): IDisposable {
	return Disposable.None;
}
