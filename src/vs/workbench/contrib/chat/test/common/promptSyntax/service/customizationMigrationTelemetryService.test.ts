/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../../../base/common/event.js';
import { DeferredPromise } from '../../../../../../../base/common/async.js';
import { observableValue } from '../../../../../../../base/common/observable.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../../../platform/log/common/log.js';
import { TestTelemetryService } from '../../../../../../../platform/telemetry/test/common/testTelemetryService.js';
import { IChatService } from '../../../../common/chatService/chatService.js';
import { IChatModel, IChatRequestModel, IChatResponseModel } from '../../../../common/model/chatModel.js';
import { CustomizationMigrationType, FileCustomizationMigrationFailureReason } from '../../../../common/promptSyntax/service/customizationMigrationService.js';
import { CustomizationMigrationTelemetryService, parseCustomizationMigrationAgentResult } from '../../../../common/promptSyntax/service/customizationMigrationTelemetryService.js';

suite('CustomizationMigrationTelemetryService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not collect migration impressions, actions, or outcomes', () => {
		const telemetryService = new TestTelemetryService();
		const service = store.add(new CustomizationMigrationTelemetryService(telemetryService, new NullLogService(), new class extends mock<IChatService>() { }));
		const hint = {
			migrationFlowId: 'migration-flow-id',
			message: 'Migration hint',
			counts: [{ type: CustomizationMigrationType.PromptFiles, count: 3 }],
		};

		service.hintComputed(new Proxy(hint, { get: () => { throw new Error('Hint must not be inspected for analytics'); } }));
		service.hintShown(hint);
		service.hintClicked(hint, 'review');
		service.hintClicked(hint, 'dismiss');
		service.pageShown();
		service.pageShown(CustomizationMigrationType.PromptFiles);
		service.actionClicked('migrationCategoryClicked', CustomizationMigrationType.PromptFiles);
		service.actionClicked('agentMigrationClicked');
		service.migrationClicked(CustomizationMigrationType.PromptFiles, 3, hint.migrationFlowId);
		service.migrationCompleted(CustomizationMigrationType.PromptFiles, 3, 2, 1, [
			FileCustomizationMigrationFailureReason.TargetWriteFailed,
			FileCustomizationMigrationFailureReason.TargetWriteFailed,
			FileCustomizationMigrationFailureReason.RollbackFailed,
		], hint.migrationFlowId);
		service.migrationCompleted(CustomizationMigrationType.McpServers, 0, 0, 0, [], hint.migrationFlowId, true);

		assert.deepStrictEqual(telemetryService.events, []);
	});

	test('parses aggregate outcomes from an agent migration result', () => {
		const report = parseCustomizationMigrationAgentResult(JSON.stringify({
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: true,
			results: [
				{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 2 },
				{ category: 'promptFiles', scope: 'user', customizationType: 'skill', outcome: 'failed', count: 1 },
				{ category: 'promptFiles', scope: 'user', customizationType: 'skill', outcome: 'skipped', count: 1 },
			],
		}), 'migration-flow-id', new Map([[CustomizationMigrationType.PromptFiles, 4]]));

		assert.deepStrictEqual(report, {
			cancelled: true,
			outcomes: [{
				category: CustomizationMigrationType.PromptFiles,
				requestedCount: 3,
				migratedCount: 2,
				failedCount: 1,
			}],
		});
	});

	test('accepts one validated tool result and updates lifecycle without telemetry', async () => {
		const telemetryService = new TestTelemetryService();
		const service = store.add(new CustomizationMigrationTelemetryService(telemetryService, new NullLogService(), new class extends mock<IChatService>() { }));
		const statuses: string[] = [];
		store.add(service.prepareAgentMigrationResult(
			'migration-flow-id',
			new Map([[CustomizationMigrationType.PromptFiles, 2]]),
			{ onDidFinish: async status => { statuses.push(status); } },
		));

		await assert.rejects(() => service.reportAgentMigrationResult({
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: false,
			results: [{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 3 }],
		}), /exceeds the supplied inventory/);
		await assert.rejects(() => service.reportAgentMigrationResult({
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: false,
			results: [{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 1 }],
		}), /does not account for the supplied inventory/);
		await service.reportAgentMigrationResult({
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: false,
			results: [
				{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 1 },
				{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'failed', count: 1 },
			],
		});
		await assert.rejects(() => service.reportAgentMigrationResult({
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: false,
			results: [{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 1 }],
		}), /No pending customization migration/);

		assert.deepStrictEqual({
			statuses,
			events: telemetryService.events,
		}, {
			statuses: ['completed'],
			events: [],
		});
	});

	test('does not report zero outcomes when a migration finishes without a tool result', () => {
		const telemetryService = new TestTelemetryService();
		const service = store.add(new CustomizationMigrationTelemetryService(telemetryService, new NullLogService(), new class extends mock<IChatService>() {
			override readonly onDidDisposeSession = Event.None;
			override getSession() {
				return undefined;
			}
		}));
		const statuses: string[] = [];
		store.add(service.prepareAgentMigrationResult(
			'migration-flow-id',
			new Map([[CustomizationMigrationType.PromptFiles, 2]]),
			{ onDidFinish: async status => { statuses.push(status); } },
		));

		service.bindAgentMigrationSession('migration-flow-id', URI.parse('agent-host-test:/missing'));

		assert.deepStrictEqual({ statuses, events: telemetryService.events }, {
			statuses: ['unknown'],
			events: [],
		});
	});

	test('allows only one terminal status while completion is pending', async () => {
		const modelChange = store.add(new Emitter<IChatModel['onDidChange'] extends Event<infer T> ? T : never>());
		let cancelled = false;
		const hasActiveRequest = observableValue('hasActiveRequest', true);
		const response = upcastPartial<IChatResponseModel>({
			get isCanceled() {
				return cancelled;
			},
			get isComplete() {
				return cancelled;
			},
		});
		const model = upcastPartial<IChatModel>({
			onDidChange: modelChange.event,
			lastRequest: upcastPartial<IChatRequestModel>({ response }),
			hasActiveRequest,
		});
		const lifecycleStarted = new DeferredPromise<void>();
		const lifecycleRelease = new DeferredPromise<void>();
		const statuses: string[] = [];
		const service = store.add(new CustomizationMigrationTelemetryService(new TestTelemetryService(), new NullLogService(), new class extends mock<IChatService>() {
			override readonly onDidDisposeSession = Event.None;
			override getSession() {
				return model;
			}
		}));
		store.add(service.prepareAgentMigrationResult(
			'migration-flow-id',
			new Map([[CustomizationMigrationType.PromptFiles, 1]]),
			{
				onDidFinish: async status => {
					statuses.push(status);
					lifecycleStarted.complete();
					await lifecycleRelease.p;
				},
			},
		));
		service.bindAgentMigrationSession('migration-flow-id', URI.parse('agent-host-test:/session'));

		const report = service.reportAgentMigrationResult({
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: false,
			results: [{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 1 }],
		});
		await lifecycleStarted.p;
		cancelled = true;
		hasActiveRequest.set(false, undefined);
		modelChange.fire({ kind: 'initialize' });
		lifecycleRelease.complete();
		await report;

		assert.deepStrictEqual(statuses, ['completed']);
	});

	test('allows retrying a result when the lifecycle update fails', async () => {
		const telemetryService = new TestTelemetryService();
		let attempt = 0;
		const service = store.add(new CustomizationMigrationTelemetryService(telemetryService, new NullLogService(), new class extends mock<IChatService>() { }));
		store.add(service.prepareAgentMigrationResult(
			'migration-flow-id',
			new Map([[CustomizationMigrationType.PromptFiles, 1]]),
			{
				onDidFinish: async () => {
					if (attempt++ === 0) {
						throw new Error('Could not update recovery');
					}
				},
			},
		));
		const result = {
			version: 1,
			migrationFlowId: 'migration-flow-id',
			cancelled: false,
			results: [{ category: 'promptFiles', scope: 'workspace', customizationType: 'skill', outcome: 'migrated', count: 1 }],
		};

		await assert.rejects(() => service.reportAgentMigrationResult(result), /Could not update recovery/);
		await service.reportAgentMigrationResult(result);

		assert.deepStrictEqual({
			attempt,
			events: telemetryService.events,
		}, {
			attempt: 2,
			events: [],
		});
	});
});
