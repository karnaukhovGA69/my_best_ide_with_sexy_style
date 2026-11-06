/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IAgentSubscription } from '../../../../../../platform/agentHost/common/state/agentSubscription.js';
import { SessionState } from '../../../../../../platform/agentHost/common/state/sessionState.js';

/** Compatibility surface; prompt cache expiration notifications are disabled. */
export class AgentHostPromptCacheNotification extends Disposable {
	trackSession(_sessionResource: URI, _subscription: IAgentSubscription<SessionState>): IDisposable {
		return Disposable.None;
	}
}
