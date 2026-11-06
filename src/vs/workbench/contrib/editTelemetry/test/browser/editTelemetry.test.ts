/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { AiEditTelemetryServiceImpl } from '../../browser/telemetry/aiEditTelemetry/aiEditTelemetryServiceImpl.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('Edit Telemetry', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not forward Agent Host session metadata for accepted or rejected edits', () => {
		const instantiationService = store.add(new TestInstantiationService());
		const sentTelemetry: { readonly eventName: string; readonly data: Record<string, unknown> | undefined }[] = [];
		instantiationService.stub(ITelemetryService, {
			publicLog2(eventName, data) {
				sentTelemetry.push({ eventName, data });
			},
		});
		const aiEditTelemetryService = instantiationService.createInstance(AiEditTelemetryServiceImpl);
		const baseData = {
			suggestionId: undefined,
			presentation: 'highlightedEdit' as const,
			feature: 'inlineChat' as const,
			source: undefined,
			languageId: undefined,
			editDeltaInfo: undefined,
			modeId: undefined,
			applyCodeBlockSuggestionId: undefined,
			modelId: undefined,
			sourceRequestId: undefined,
		};

		aiEditTelemetryService.createSuggestionId({ ...baseData, isAgentHostSession: true });
		aiEditTelemetryService.handleCodeAccepted({ ...baseData, acceptanceMethod: 'copyButton', presentation: 'codeBlock', feature: 'sideBarChat', isAgentHostSession: true, provider: 'copilotcli', sourceRequestId: 'request-origin', chatSessionId: 'agent-host-copilotcli:/session#chat' });
		aiEditTelemetryService.handleCodeRejected({ ...baseData, rejectionMethod: 'reject', isAgentHostSession: false });

		assert.deepStrictEqual(sentTelemetry, []);
		const ids = { agentSessionId: 'owner', chatSessionId: 'agent-host-copilotcli:/owner#peer', sourceRequestId: 'source-turn' };
		aiEditTelemetryService.handleCodeAccepted({ ...baseData, ...ids, acceptanceMethod: 'accept', isAgentHostSession: true });
		aiEditTelemetryService.handleCodeRejected({ ...baseData, ...ids, rejectionMethod: 'reject', isAgentHostSession: true });
		assert.deepStrictEqual(sentTelemetry, []);
	});
});
