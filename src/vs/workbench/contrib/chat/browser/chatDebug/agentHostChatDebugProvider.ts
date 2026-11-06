/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { isCustomizationEnabled } from '../../../../../platform/agentHost/common/customizationEnablement.js';
import { CustomizationType, type ChildCustomization, type Customization } from '../../../../../platform/agentHost/common/state/sessionState.js';
import { IWorkbenchContribution } from '../../../../common/contributions.js';
import { ChatDebugHookResult, ChatDebugLogLevel, IChatDebugCustomizationLogEntry, IChatDebugEvent, IChatDebugFileEntry, IChatDebugMessageSection, IChatDebugModelTurnEvent, IChatDebugResolvedEventContent } from '../../common/chatDebugService.js';
import { type IAgentHostUsageRecord } from './agentHostUsageSidecar.js';

/**
 * One record in an Agent Host Copilot CLI `events.jsonl` stream. The CLI
 * writes a line-delimited JSON log of the session under
 * `<COPILOT_HOME>/session-state/<id>/events.jsonl`. Every record shares the same
 * envelope. Note that `parentId` is **not** a logical parent: the SDK defines
 * it as the chronologically preceding event in the session (a flat linked chain
 * over every event), not the user → model-turn → tool-call hierarchy. The
 * panel's trajectory tree is instead reconstructed from each record's logical
 * context (turn / tool-call / agent ids); see
 * {@link convertAgentHostEventsToDebugEvents}.
 */
interface IAgentHostEventRecord {
	readonly type: string;
	readonly id: string;
	readonly parentId: string | null;
	/** Sub-agent instance id; absent for the main agent and session-level events. */
	readonly agentId?: string;
	readonly timestamp: string;
	readonly data: Record<string, unknown>;
}

/** Cap on a tool argument/result string stored on the (list-level) event. */
const MAX_EVENT_PAYLOAD = 4_000;
/** Cap on a tool argument/result string stored for the detail (expanded) view. */
const MAX_DETAIL_PAYLOAD = 100_000;

/** Compatibility contribution; AI debug provider registration and live capture are disabled. */
export class AgentHostChatDebugContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.agentHostChatDebug';
}

/**
 * Converts a parsed `events.jsonl` record stream into debug-panel events plus
 * their expanded detail. Pure (no services) so it can be unit-tested directly.
 *
 * The record `parentId` is **not** a logical parent: the Copilot SDK documents
 * it as "the chronologically preceding event in the session, forming a linked
 * chain" — a flat back-pointer over every event, not the user → model-turn →
 * tool-call hierarchy the panel's flow chart needs. So we reconstruct that
 * hierarchy from each record's logical context as we iterate chronologically:
 *   - `session.start` is the tree root.
 *   - a `user.message` hangs off the session root.
 *   - an `assistant.message` hangs off the current user message (tracked per
 *     agent), unless it carries a `parentToolCallId` (a sub-agent turn), in
 *     which case it hangs off that spawning tool call.
 *   - a `tool.execution_start` hangs off the current assistant message (tracked
 *     per agent), unless it carries a `parentToolCallId` (a nested / sub-agent
 *     tool), in which case it hangs off that parent tool call.
 * `tool.execution_start` and `tool.execution_complete` records share a
 * `toolCallId` and are merged into a single tool-call event.
 */
export function convertAgentHostEventsToDebugEvents(
	records: readonly IAgentHostEventRecord[],
	sessionResource: URI,
	fallbackUsageTotals?: ISessionUsageTotals,
	usageRecords?: readonly IAgentHostUsageRecord[],
	customizations?: readonly Customization[],
): { readonly events: IChatDebugEvent[]; readonly resolved: Map<string, IChatDebugResolvedEventContent> } {
	// Pre-pass: index `tool.execution_complete` records by `toolCallId` (so a
	// start can be merged with its completion) and `assistant.turn_start` records
	// by `turnId` (so a turn's wall-clock duration can be measured). Also index
	// `hook.end`, `permission.completed`, and `subagent.completed` so each can be
	// folded onto its opening record (`hook.start` / `permission.requested` /
	// `subagent.started`).
	const completeByToolCallId = new Map<string, IAgentHostEventRecord>();
	const turnStartByTurnId = new Map<string, IAgentHostEventRecord>();
	const hookEndByInvocationId = new Map<string, IAgentHostEventRecord>();
	const permissionCompleteByRequestId = new Map<string, IAgentHostEventRecord>();
	const subagentCompleteByToolCallId = new Map<string, IAgentHostEventRecord>();
	for (const record of records) {
		if (record.type === 'tool.execution_complete') {
			const toolCallId = asString(record.data.toolCallId);
			if (toolCallId) {
				completeByToolCallId.set(toolCallId, record);
			}
		} else if (record.type === 'assistant.turn_start') {
			const turnId = asString(record.data.turnId);
			if (turnId) {
				turnStartByTurnId.set(turnId, record);
			}
		} else if (record.type === 'hook.end') {
			const invocationId = asString(record.data.hookInvocationId);
			if (invocationId) {
				hookEndByInvocationId.set(invocationId, record);
			}
		} else if (record.type === 'permission.completed') {
			const requestId = asString(record.data.requestId);
			if (requestId) {
				permissionCompleteByRequestId.set(requestId, record);
			}
		} else if (record.type === 'subagent.completed') {
			const toolCallId = asString(record.data.toolCallId);
			if (toolCallId) {
				subagentCompleteByToolCallId.set(toolCallId, record);
			}
		}
	}

	const events: IChatDebugEvent[] = [];
	const resolved = new Map<string, IChatDebugResolvedEventContent>();
	// Positions of emitted model-turn events, so per-round usage from the sidecar
	// (preferred) or session-cumulative usage from `session.shutdown` can be
	// back-filled onto them (see below).
	const modelTurnRefs: IModelTurnRef[] = [];

	// Logical-tree context. The "current message" pointers are tracked per agent
	// (keyed by `agentId`, `''` for the main agent) so a sub-agent turn never
	// re-parents a main-agent tool call, and vice versa.
	let rootEventId: string | undefined;
	let rootCreated: Date | undefined;
	const currentUserMessageByAgent = new Map<string, string>();
	const currentAssistantMessageByAgent = new Map<string, string>();
	// Maps a `toolCallId` to the id of its emitted tool-call event, so a nested
	// tool's `parentToolCallId` can be resolved to a surfaced parent.
	const toolEventByToolCallId = new Map<string, string>();

	// Whether the session has at least one enabled hook customization. The CLI
	// emits `preToolUse` / `postToolUse` lifecycle `hook.start` records on *every*
	// tool call regardless of user configuration (VS Code itself uses the
	// `preToolUse` dispatch for tool-permission gating), and a routine successful
	// run is byte-identical to the internal dispatch. We therefore only surface
	// tool hooks when the user actually configured one — so the debug view can
	// confirm it ran, whether it succeeded or failed — and suppress the pure
	// internal-dispatch noise otherwise. `HookCustomization` does not expose which
	// lifecycle events it registers, so this gate is session-level.
	const hasConfiguredHooks = !!customizations
		&& flattenCustomizations(customizations).some(c => c.type === CustomizationType.Hook && c.enabled);

	for (const record of records) {
		const created = new Date(record.timestamp);
		const agentKey = record.agentId ?? '';
		// Parent for events that annotate the turn in progress (errors, warnings,
		// permissions, hooks, …): the current assistant message, else the current
		// user message, else the session root.
		const turnParent = currentAssistantMessageByAgent.get(agentKey) ?? currentUserMessageByAgent.get(agentKey) ?? rootEventId;

		switch (record.type) {
			case 'session.start': {
				rootEventId = record.id;
				rootCreated = created;
				const model = asString(record.data.selectedModel);
				const effort = asString(record.data.reasoningEffort);
				const version = asString(record.data.copilotVersion);
				const context = asRecord(record.data.context);
				const repository = asString(context?.repository);
				const branch = asString(context?.branch);
				const parts: string[] = [];
				if (model) {
					parts.push(effort
						? localize('agentHost.debug.sessionStartedDetails', "model={0}, reasoningEffort={1}", model, effort)
						: localize('agentHost.debug.sessionStartedModel', "model={0}", model));
				}
				if (version) {
					parts.push(localize('agentHost.debug.sessionCliVersion', "CLI {0}", version));
				}
				if (repository) {
					parts.push(branch
						? localize('agentHost.debug.sessionRepoBranch', "{0}@{1}", repository, branch)
						: repository);
				}
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: undefined,
					name: localize('agentHost.debug.sessionStarted', "Session Started"),
					details: parts.length ? parts.join(', ') : undefined, level: ChatDebugLogLevel.Info, category: 'session',
				});
				break;
			}
			case 'user.message': {
				const content = asString(record.data.content) ?? '';
				const transformed = asString(record.data.transformedContent);
				const sections: IChatDebugMessageSection[] = [
					{ name: localize('agentHost.debug.userRequest', "User Request"), content },
				];
				if (transformed && transformed !== content) {
					sections.push({ name: localize('agentHost.debug.fullPrompt', "Full Prompt"), content: transformed });
				}
				const message = summarize(content);
				currentUserMessageByAgent.set(agentKey, record.id);
				currentAssistantMessageByAgent.delete(agentKey); // a new user turn starts fresh
				events.push({ kind: 'userMessage', id: record.id, sessionResource, created, parentEventId: rootEventId, message, sections });
				resolved.set(record.id, { kind: 'message', type: 'user', message, sections });
				break;
			}
			case 'assistant.message': {
				const model = asString(record.data.model);
				const outputTokens = asNumber(record.data.outputTokens);
				const content = asString(record.data.content) ?? '';
				const reasoning = asString(record.data.reasoningText);
				// A sub-agent turn nests under its spawning tool call; a normal turn
				// nests under the user message it answers.
				const parentToolCallId = asString(record.data.parentToolCallId);
				const spawningTool = parentToolCallId ? toolEventByToolCallId.get(parentToolCallId) : undefined;
				const parentEventId = spawningTool ?? currentUserMessageByAgent.get(agentKey) ?? rootEventId;
				// The turn's wall-clock duration is the gap from its `assistant.turn_start`.
				const turnId = asString(record.data.turnId);
				const turnStart = turnId ? turnStartByTurnId.get(turnId) : undefined;
				const durationInMillis = turnStart ? diffMillis(turnStart.timestamp, record.timestamp) : undefined;

				currentAssistantMessageByAgent.set(agentKey, record.id);
				modelTurnRefs.push({ index: events.length, id: record.id, turnId, outputTokens, apiCallId: asString(record.data.apiCallId) });
				events.push({
					kind: 'modelTurn', id: record.id, sessionResource, created, parentEventId,
					model, requestName: 'copilotcli', outputTokens, durationInMillis,
				});

				const sections: IChatDebugMessageSection[] = [];
				if (content) {
					sections.push({ name: localize('agentHost.debug.response', "Response"), content });
				}
				if (reasoning) {
					sections.push({ name: localize('agentHost.debug.reasoning', "Reasoning"), content: reasoning });
				}
				resolved.set(record.id, { kind: 'modelTurn', requestName: 'copilotcli', model, outputTokens, durationInMillis, sections });
				break;
			}
			case 'tool.execution_start': {
				const toolName = asString(record.data.toolName) ?? 'tool';
				const toolCallId = asString(record.data.toolCallId);
				const complete = toolCallId ? completeByToolCallId.get(toolCallId) : undefined;
				const success = complete ? asBoolean(complete.data.success) : undefined;
				const result = success === undefined ? undefined : (success ? 'success' : 'error');
				const durationInMillis = complete ? diffMillis(record.timestamp, complete.timestamp) : undefined;
				const fullInput = stringifyPayload(record.data.arguments);
				const fullOutput = complete ? stringifyPayload(complete.data.result) : undefined;
				// A nested / sub-agent tool nests under its parent tool call; a
				// top-level tool nests under the assistant message that requested it.
				const parentToolCallId = asString(record.data.parentToolCallId);
				const parentTool = parentToolCallId ? toolEventByToolCallId.get(parentToolCallId) : undefined;
				const parentEventId = parentTool ?? currentAssistantMessageByAgent.get(agentKey) ?? currentUserMessageByAgent.get(agentKey) ?? rootEventId;
				if (toolCallId) {
					toolEventByToolCallId.set(toolCallId, record.id);
				}

				events.push({
					kind: 'toolCall', id: record.id, sessionResource, created, parentEventId,
					toolName, toolCallId, result, durationInMillis,
					input: truncate(fullInput, MAX_EVENT_PAYLOAD),
					output: truncate(fullOutput, MAX_EVENT_PAYLOAD),
				});
				resolved.set(record.id, {
					kind: 'toolCall', toolName, result, durationInMillis,
					input: truncate(fullInput, MAX_DETAIL_PAYLOAD),
					output: truncate(fullOutput, MAX_DETAIL_PAYLOAD),
				});
				break;
			}
			// `tool.execution_complete` is folded into its start record above.
			case 'session.error': {
				const message = asString(record.data.message) ?? localize('agentHost.debug.unknownError', "Unknown error");
				const errorType = asString(record.data.errorType);
				const stack = asString(record.data.stack);
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: errorType
						? localize('agentHost.debug.sessionErrorTyped', "Error ({0})", errorType)
						: localize('agentHost.debug.sessionError', "Error"),
					details: truncate(message, MAX_EVENT_PAYLOAD),
					level: ChatDebugLogLevel.Error, category: 'session',
				});
				const detailText = stack ? `${message}\n\n${stack}` : message;
				resolved.set(record.id, { kind: 'text', value: truncate(detailText, MAX_DETAIL_PAYLOAD) ?? detailText });
				break;
			}
			case 'session.warning': {
				const message = asString(record.data.message) ?? '';
				const warningType = asString(record.data.warningType);
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: warningType
						? localize('agentHost.debug.sessionWarningTyped', "Warning ({0})", warningType)
						: localize('agentHost.debug.sessionWarning', "Warning"),
					details: truncate(message, MAX_EVENT_PAYLOAD),
					level: ChatDebugLogLevel.Warning, category: 'session',
				});
				if (message) {
					resolved.set(record.id, { kind: 'text', value: truncate(message, MAX_DETAIL_PAYLOAD) ?? message });
				}
				break;
			}
			case 'session.model_change': {
				const previousModel = asString(record.data.previousModel);
				const newModel = asString(record.data.newModel);
				const effort = asString(record.data.reasoningEffort);
				const change = previousModel && newModel
					? localize('agentHost.debug.modelChangeFromTo', "{0} → {1}", previousModel, newModel)
					: newModel;
				const details = change && effort
					? localize('agentHost.debug.modelChangeEffort', "{0} (reasoningEffort={1})", change, effort)
					: change;
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: localize('agentHost.debug.modelChanged', "Model Changed"),
					details, level: ChatDebugLogLevel.Info, category: 'session',
				});
				break;
			}
			case 'hook.start': {
				const hookType = asString(record.data.hookType) ?? 'hook';
				const invocationId = asString(record.data.hookInvocationId);
				const end = invocationId ? hookEndByInvocationId.get(invocationId) : undefined;
				const success = end ? asBoolean(end.data.success) : undefined;
				const isError = hookType === 'errorOccurred';
				// The CLI emits `preToolUse` / `postToolUse` lifecycle hooks on every
				// tool call regardless of user configuration. Only surface them when the
				// user actually configured a hook (so the view can confirm it ran); hide
				// the pure internal-dispatch noise otherwise.
				if ((hookType === 'preToolUse' || hookType === 'postToolUse') && !hasConfiguredHooks) {
					break;
				}
				// A `preToolUse` hook fires *before* the `assistant.message` of the
				// turn whose tool it precedes is finalized, so `turnParent` still
				// points at the PREVIOUS model turn. Nesting it there is misleading —
				// it belongs to the upcoming turn — so surface it at the
				// turn-container (user message) level, as a sibling of the model
				// turns rather than a child of the prior one.
				const hookParent = hookType === 'preToolUse'
					? (currentUserMessageByAgent.get(agentKey) ?? rootEventId)
					: turnParent;
				// Error notifications (`errorOccurred`) and failed hooks are surfaced
				// prominently below. Routine lifecycle hooks (sessionStart / sessionEnd
				// / userPromptSubmitted / …) are surfaced as low-key informational
				// customization events so users can still see which hooks fired.
				if (!isError && success !== false) {
					events.push({
						kind: 'generic', id: record.id, sessionResource, created, parentEventId: hookParent,
						name: localize('agentHost.debug.hookRan', "Hook: {0}", hookType),
						level: ChatDebugLogLevel.Info, category: 'hook',
					});
					const routineInput = stringifyPayload(record.data.input);
					resolved.set(record.id, {
						kind: 'hook', hookType,
						result: success === undefined ? undefined : (success ? ChatDebugHookResult.Success : ChatDebugHookResult.Error),
						input: truncate(routineInput, MAX_DETAIL_PAYLOAD),
					});
					break;
				}
				const input = asRecord(record.data.input);
				const errorContext = asString(input?.errorContext);
				const recoverable = asBoolean(input?.recoverable);
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: hookParent,
					name: isError
						? (errorContext
							? localize('agentHost.debug.hookErrorContext', "Error During {0}", errorContext)
							: localize('agentHost.debug.hookError', "Error Occurred"))
						: localize('agentHost.debug.hookFailed', "Hook Failed: {0}", hookType),
					details: isError && recoverable !== undefined
						? (recoverable
							? localize('agentHost.debug.hookRecoverable', "Recoverable; retrying")
							: localize('agentHost.debug.hookUnrecoverable', "Unrecoverable"))
						: undefined,
					level: isError
						? (recoverable === false ? ChatDebugLogLevel.Error : ChatDebugLogLevel.Warning)
						: ChatDebugLogLevel.Error,
					category: 'hook',
				});
				const inputText = stringifyPayload(record.data.input);
				// On failure the `hook.end` record carries the only distinguishing trace
				// of the user's hook: `output` (per-tool denial messages) and `error`
				// ({ message, source }, where `source` is the hook config file). The CLI
				// never records the hook command text or its stdout, so this is the most
				// we can surface about which hook acted and why.
				const endError = asRecord(end?.data.error);
				const errorParts = endError
					? [asString(endError.message), asString(endError.source)].filter((s): s is string => !!s)
					: [];
				const outputText = end && end.data.output !== undefined ? stringifyPayload(end.data.output) : undefined;
				resolved.set(record.id, {
					kind: 'hook', hookType,
					result: success === undefined ? undefined : (success ? ChatDebugHookResult.Success : ChatDebugHookResult.Error),
					input: truncate(inputText, MAX_DETAIL_PAYLOAD),
					output: outputText ? truncate(outputText, MAX_DETAIL_PAYLOAD) : undefined,
					errorMessage: errorParts.length > 0 ? truncate(errorParts.join('\n'), MAX_DETAIL_PAYLOAD) : undefined,
				});
				break;
			}
			// `hook.end` is folded into its `hook.start` above.
			case 'permission.requested': {
				const requestId = asString(record.data.requestId);
				const permissionRequest = asRecord(record.data.permissionRequest);
				const kind = asString(permissionRequest?.kind) ?? 'permission';
				const intention = asString(permissionRequest?.intention);
				const toolCallId = asString(permissionRequest?.toolCallId);
				const completed = requestId ? permissionCompleteByRequestId.get(requestId) : undefined;
				const resultKind = completed ? asString(asRecord(completed.data.result)?.kind) : undefined;
				// A routine approval is happy-path noise (the tool call is already
				// shown); only surface denials and still-pending requests, which
				// explain why a tool was blocked or a session appears stalled.
				if (resultKind === 'approved') {
					break;
				}
				const parentEventId = (toolCallId ? toolEventByToolCallId.get(toolCallId) : undefined) ?? turnParent;
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId,
					name: resultKind
						? localize('agentHost.debug.permissionResolved', "Permission {0}: {1}", resultKind, kind)
						: localize('agentHost.debug.permissionPending', "Awaiting Permission: {0}", kind),
					details: intention,
					level: ChatDebugLogLevel.Warning, category: 'permission',
				});
				const path = asString(permissionRequest?.path);
				const lines = [
					localize('agentHost.debug.permissionKind', "kind: {0}", kind),
					intention ? localize('agentHost.debug.permissionIntention', "intention: {0}", intention) : undefined,
					path ? localize('agentHost.debug.permissionPath', "path: {0}", path) : undefined,
					localize('agentHost.debug.permissionResult', "result: {0}", resultKind ?? localize('agentHost.debug.permissionPendingValue', "pending")),
				].filter((l): l is string => !!l);
				resolved.set(record.id, { kind: 'text', value: lines.join('\n') });
				break;
			}
			// `permission.completed` is folded into its `permission.requested` above.
			case 'subagent.started': {
				const toolCallId = asString(record.data.toolCallId);
				const agentName = asString(record.data.agentDisplayName) ?? asString(record.data.agentName) ?? 'subagent';
				const description = asString(record.data.agentDescription);
				const model = asString(record.data.model);
				const complete = toolCallId ? subagentCompleteByToolCallId.get(toolCallId) : undefined;
				const toolCallCount = complete ? asNumber(complete.data.totalToolCalls) : undefined;
				const totalTokens = complete ? asNumber(complete.data.totalTokens) : undefined;
				const durationInMillis = complete ? asNumber(complete.data.durationMs) : undefined;
				// The sub-agent nests under the tool call that spawned it.
				const parentEventId = (toolCallId ? toolEventByToolCallId.get(toolCallId) : undefined) ?? turnParent;
				events.push({
					kind: 'subagentInvocation', id: record.id, sessionResource, created, parentEventId,
					agentName, description, status: complete ? 'completed' : 'running', toolCallCount, durationInMillis,
				});
				const lines = [
					localize('agentHost.debug.subagentName', "agent: {0}", agentName),
					model ? localize('agentHost.debug.subagentModel', "model: {0}", model) : undefined,
					toolCallCount !== undefined ? localize('agentHost.debug.subagentToolCalls', "tool calls: {0}", toolCallCount) : undefined,
					totalTokens !== undefined ? localize('agentHost.debug.subagentTokens', "tokens: {0}", totalTokens) : undefined,
					description ? `\n${description}` : undefined,
				].filter((l): l is string => !!l);
				resolved.set(record.id, { kind: 'text', value: lines.join('\n') });
				break;
			}
			// `subagent.completed` is folded into its `subagent.started` above.
			case 'session.compaction_start': {
				const systemTokens = asNumber(record.data.systemTokens) ?? 0;
				const conversationTokens = asNumber(record.data.conversationTokens) ?? 0;
				const toolTokens = asNumber(record.data.toolDefinitionsTokens) ?? 0;
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: localize('agentHost.debug.compaction', "Context Compaction"),
					details: localize('agentHost.debug.compactionTokens', "system={0}, conversation={1}, tools={2} tokens", systemTokens, conversationTokens, toolTokens),
					level: ChatDebugLogLevel.Info, category: 'session',
				});
				break;
			}
			case 'session.compaction_complete': {
				// A successful compaction is implied by its start row; only the
				// failure case is diagnostically interesting.
				if (asBoolean(record.data.success) !== false) {
					break;
				}
				const error = asString(record.data.error);
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: localize('agentHost.debug.compactionFailed', "Context Compaction Failed"),
					details: truncate(error, MAX_EVENT_PAYLOAD),
					level: ChatDebugLogLevel.Error, category: 'session',
				});
				if (error) {
					resolved.set(record.id, { kind: 'text', value: truncate(error, MAX_DETAIL_PAYLOAD) ?? error });
				}
				break;
			}
			case 'abort': {
				const reason = asString(record.data.reason);
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: localize('agentHost.debug.aborted', "Aborted"),
					details: reason, level: ChatDebugLogLevel.Warning, category: 'session',
				});
				break;
			}
			case 'skill.invoked': {
				const name = asString(record.data.name) ?? 'skill';
				const trigger = asString(record.data.trigger);
				const source = asString(record.data.pluginName) ?? asString(record.data.source);
				const content = asString(record.data.content);
				events.push({
					kind: 'generic', id: record.id, sessionResource, created, parentEventId: turnParent,
					name: localize('agentHost.debug.skillInvoked', "Skill Invoked: {0}", name),
					details: [trigger, source].filter(Boolean).join(' \u00b7 ') || undefined,
					level: ChatDebugLogLevel.Info, category: 'customization',
				});
				if (content) {
					resolved.set(record.id, { kind: 'text', value: truncate(content, MAX_DETAIL_PAYLOAD) ?? content });
				}
				break;
			}
			// `assistant.turn_start` seeds turn durations (pre-pass); its
			// `assistant.turn_end` and `system.message` siblings are not surfaced
			// in this slice.
		}
	}

	// Usage back-fill. `events.jsonl` records only `outputTokens` per turn;
	// input/cache-read tokens and Copilot AIU come from elsewhere:
	//   1. The client-local usage sidecar (preferred): exact per-request tokens
	//      captured live from ChatUsage actions, mapped per round — restart-safe
	//      and accurate for the Cache Explorer.
	//   2. Else the `session.shutdown` summary (exact totals, spread evenly).
	//   3. Else the live AHP state (AIU only) for in-progress sessions.
	// The per-turn split in (2) is an even approximation but the column sums are
	// exact; totals that aren't known (e.g. input/cache on a live session) are
	// left blank.

	// Distributes cumulative `totals` evenly across the given turns.
	const fillTurnsWithTotals = (targets: readonly IModelTurnRef[], totals: ISessionUsageTotals) => {
		const n = targets.length;
		if (n === 0) {
			return;
		}
		const inputs = totals.inputTokens !== undefined ? distributeEvenly(totals.inputTokens, n) : undefined;
		const cached = totals.cacheReadTokens !== undefined ? distributeEvenly(totals.cacheReadTokens, n) : undefined;
		const aiu = distributeEvenly(totals.totalNanoAiu, n);
		for (let i = 0; i < n; i++) {
			const ref = targets[i];
			const turn = events[ref.index] as IChatDebugModelTurnEvent;
			const inputTokens = inputs?.[i];
			const cachedTokens = cached?.[i];
			const totalTokens = inputTokens !== undefined ? inputTokens + (ref.outputTokens ?? 0) : undefined;
			const copilotUsageNanoAiu = aiu[i] > 0 ? aiu[i] : undefined;
			events[ref.index] = { ...turn, inputTokens, cachedTokens, totalTokens, copilotUsageNanoAiu };
			const detail = resolved.get(ref.id);
			if (detail?.kind === 'modelTurn') {
				resolved.set(ref.id, { ...detail, inputTokens, cachedTokens, totalTokens });
			}
		}
	};

	if (usageRecords && usageRecords.length > 0 && modelTurnRefs.length > 0) {
		const coverage = applyPerTurnUsage(events, resolved, modelTurnRefs, usageRecords);
		// The sidecar may only cover a prefix of the session's turns (logging
		// enabled mid-session, or a dropped append). Reconcile the remaining
		// turns from the authoritative shutdown/live totals so the Overview
		// aggregates aren't undercounted, keeping the exact per-round values we
		// did capture.
		const uncovered = modelTurnRefs.filter((_ref, i) => !coverage.covered.has(i));
		if (uncovered.length > 0) {
			const totals = extractSessionUsageTotals(records) ?? fallbackUsageTotals;
			if (totals) {
				fillTurnsWithTotals(uncovered, {
					inputTokens: totals.inputTokens !== undefined ? Math.max(0, totals.inputTokens - coverage.assignedInput) : undefined,
					cacheReadTokens: totals.cacheReadTokens !== undefined ? Math.max(0, totals.cacheReadTokens - coverage.assignedCache) : undefined,
					totalNanoAiu: Math.max(0, totals.totalNanoAiu - coverage.assignedAiu),
				});
			}
		}
		if (usageRecords.some(record => record.schemaVersion === 2)) {
			const totals = extractSessionUsageTotals(records) ?? fallbackUsageTotals;
			const unpriced = modelTurnRefs.filter(ref => (events[ref.index] as IChatDebugModelTurnEvent).copilotUsageNanoAiu === undefined);
			if (totals && unpriced.length > 0) {
				const assigned = modelTurnRefs.reduce((sum, ref) => sum + ((events[ref.index] as IChatDebugModelTurnEvent).copilotUsageNanoAiu ?? 0), 0);
				const costs = distributeEvenly(Math.max(0, totals.totalNanoAiu - assigned), unpriced.length);
				for (let i = 0; i < unpriced.length; i++) {
					const ref = unpriced[i];
					events[ref.index] = { ...events[ref.index] as IChatDebugModelTurnEvent, copilotUsageNanoAiu: costs[i] > 0 ? costs[i] : undefined };
				}
			}
		}
	} else if (modelTurnRefs.length > 0) {
		const totals = extractSessionUsageTotals(records) ?? fallbackUsageTotals;
		if (totals) {
			fillTurnsWithTotals(modelTurnRefs, totals);
		}
	}

	// Surface the session's loaded customizations (skills / hooks / agents / MCP
	// servers / rules) as discovery events plus a summary, mirroring the local
	// `PromptsDebugContribution`. Sourced from live session state (the SDK's
	// `session.*_loaded` events are ephemeral and absent from events.jsonl).
	if (customizations && customizations.length > 0) {
		const created = rootCreated ?? (records.length > 0 ? new Date(records[0].timestamp) : new Date());
		const { events: customEvents, resolved: customResolved } = buildCustomizationDebugEvents(customizations, sessionResource, rootEventId, created);
		events.push(...customEvents);
		for (const [id, detail] of customResolved) {
			resolved.set(id, detail);
		}
	}

	return { events, resolved };
}

/** Order in which loaded customization types are surfaced as discovery events. */
const CUSTOMIZATION_TYPE_ORDER: readonly CustomizationType[] = [
	CustomizationType.Skill, CustomizationType.Hook, CustomizationType.Agent,
	CustomizationType.McpServer, CustomizationType.Rule, CustomizationType.Prompt,
];

/** A leaf customization flattened out of its container, with its context. */
interface IFlatCustomization {
	readonly type: CustomizationType;
	readonly name: string;
	readonly uri: string;
	readonly enabled: boolean;
	readonly description?: string;
}

/**
 * Flattens the session's customization tree into its leaf children (skills,
 * hooks, agents, MCP servers, rules, prompts). Container entries
 * ({@link CustomizationType.Plugin} / {@link CustomizationType.Directory}) are
 * descended into; a top-level {@link CustomizationType.McpServer} is kept as-is.
 */
function flattenCustomizations(customizations: readonly Customization[]): IFlatCustomization[] {
	const out: IFlatCustomization[] = [];
	const visit = (c: Customization | ChildCustomization): void => {
		if (c.type === CustomizationType.Plugin || c.type === CustomizationType.Directory) {
			for (const child of c.children ?? []) {
				visit(child);
			}
			return;
		}
		out.push({
			type: c.type,
			name: c.name,
			uri: c.uri,
			enabled: c.type === CustomizationType.McpServer
				? isCustomizationEnabled(c)
				: c.enabled !== false,
			description: (c as { description?: string }).description,
		});
	};
	for (const c of customizations) {
		visit(c);
	}
	return out;
}

/** Human-readable name for a per-type customization discovery event. */
function customizationDiscoveryName(type: CustomizationType): string {
	switch (type) {
		case CustomizationType.Skill: return localize('agentHost.debug.skillDiscovery', "Skill Discovery");
		case CustomizationType.Hook: return localize('agentHost.debug.hookDiscovery', "Hook Discovery");
		case CustomizationType.Agent: return localize('agentHost.debug.agentDiscovery', "Agent Discovery");
		case CustomizationType.McpServer: return localize('agentHost.debug.mcpDiscovery', "MCP Server Discovery");
		case CustomizationType.Rule: return localize('agentHost.debug.ruleDiscovery', "Instructions Discovery");
		case CustomizationType.Prompt: return localize('agentHost.debug.promptDiscovery', "Prompt Discovery");
		default: return localize('agentHost.debug.customizationDiscovery', "Customization Discovery");
	}
}

/** Maps a flattened customization to a summary-log category, if it has one. */
function customizationSummaryCategory(c: IFlatCustomization): IChatDebugCustomizationLogEntry['category'] | undefined {
	if (!c.enabled) {
		return 'skipped';
	}
	switch (c.type) {
		case CustomizationType.Skill: return 'skill';
		case CustomizationType.Agent: return 'custom-agent';
		case CustomizationType.Hook: return 'hook';
		case CustomizationType.Rule: return 'applying';
		default: return undefined; // Prompt / MCP have no summary category
	}
}

/**
 * Builds the customization discovery + summary debug events for a session from
 * its loaded {@link Customization}s. Ids are deterministic (per session + type)
 * so repeated live refreshes replace rather than duplicate them.
 */
export function buildCustomizationDebugEvents(
	customizations: readonly Customization[],
	sessionResource: URI,
	parentEventId: string | undefined,
	created: Date,
): { readonly events: IChatDebugEvent[]; readonly resolved: Map<string, IChatDebugResolvedEventContent> } {
	const events: IChatDebugEvent[] = [];
	const resolved = new Map<string, IChatDebugResolvedEventContent>();
	const flat = flattenCustomizations(customizations);
	if (flat.length === 0) {
		return { events, resolved };
	}

	const byType = new Map<CustomizationType, IFlatCustomization[]>();
	for (const c of flat) {
		const list = byType.get(c.type);
		if (list) {
			list.push(c);
		} else {
			byType.set(c.type, [c]);
		}
	}

	const key = sessionResource.toString();

	// Per-type discovery events, each expandable to its file list.
	for (const type of CUSTOMIZATION_TYPE_ORDER) {
		const list = byType.get(type);
		if (!list || list.length === 0) {
			continue;
		}
		const id = `agentHostCustomization:${key}:${type}`;
		const loadedCount = list.filter(c => c.enabled).length;
		const skippedCount = list.length - loadedCount;
		events.push({
			kind: 'generic', id, sessionResource, created, parentEventId,
			name: customizationDiscoveryName(type),
			details: skippedCount > 0
				? localize('agentHost.debug.customizationLoadedSkipped', "{0} loaded, {1} disabled", loadedCount, skippedCount)
				: localize('agentHost.debug.customizationLoaded', "{0} loaded", loadedCount),
			level: ChatDebugLogLevel.Info, category: 'discovery',
		});
		const files: IChatDebugFileEntry[] = list.map(c => ({
			uri: URI.parse(c.uri),
			name: c.name,
			status: c.enabled ? 'loaded' : 'skipped',
			skipReason: c.enabled ? undefined : localize('agentHost.debug.customizationDisabled', "disabled"),
		}));
		resolved.set(id, { kind: 'fileList', discoveryType: type, durationInMillis: 0, files });
	}

	// Summary event mirroring the local "Resolve Customizations".
	const logs: IChatDebugCustomizationLogEntry[] = [];
	for (const c of flat) {
		const category = customizationSummaryCategory(c);
		if (!category) {
			continue;
		}
		logs.push({ category, name: c.name, uri: URI.parse(c.uri), reason: c.description });
	}
	if (logs.length > 0) {
		const id = `agentHostCustomization:${key}:summary`;
		const counts = {
			instructions: logs.filter(e => e.category === 'applying' || e.category === 'referenced').length,
			skills: logs.filter(e => e.category === 'skill').length,
			agents: logs.filter(e => e.category === 'custom-agent').length,
			hooks: logs.filter(e => e.category === 'hook').length,
			skipped: logs.filter(e => e.category === 'skipped').length,
		};
		events.push({
			kind: 'generic', id, sessionResource, created, parentEventId,
			name: localize('agentHost.debug.customizationsResolved', "Resolve Customizations"),
			details: localize('agentHost.debug.customizationsResolvedDetails', "{0} skills, {1} agents, {2} hooks, {3} instructions", counts.skills, counts.agents, counts.hooks, counts.instructions),
			level: ChatDebugLogLevel.Info, category: 'customization',
		});
		resolved.set(id, { kind: 'customizationSummary', resolutionLogs: logs, durationInMillis: 0, counts });
	}

	return { events, resolved };
}

/** A model-turn debug event plus the context needed to back-fill its usage. */
interface IModelTurnRef {
	readonly apiCallId?: string;
	readonly index: number;
	readonly id: string;
	readonly turnId?: string;
	readonly outputTokens?: number;
}

/** What {@link applyPerTurnUsage} assigned, so callers can reconcile the rest. */
interface IPerTurnUsageCoverage {
	/** Positions in `modelTurnRefs` that received a sidecar usage record. */
	readonly covered: ReadonlySet<number>;
	/** Sum of input tokens assigned from the sidecar. */
	readonly assignedInput: number;
	/** Sum of cache-read tokens assigned from the sidecar. */
	readonly assignedCache: number;
	/** Sum of Copilot AIU (nano) assigned from the sidecar. */
	readonly assignedAiu: number;
}

function applyPerTurnUsage(
	events: IChatDebugEvent[],
	resolved: Map<string, IChatDebugResolvedEventContent>,
	modelTurnRefs: readonly IModelTurnRef[],
	usageRecords: readonly IAgentHostUsageRecord[],
): IPerTurnUsageCoverage {
	if (usageRecords.some(record => record.schemaVersion === 2)) {
		const byCallId = new Map(usageRecords.filter(record => record.schemaVersion === 2 && record.apiCallId).map(record => [record.apiCallId!, record]));
		const covered = new Set<number>();
		let assignedInput = 0;
		let assignedCache = 0;
		let assignedAiu = 0;
		const costByTurn = new Map<string, { index: number; cost: number }>();
		for (let index = 0; index < modelTurnRefs.length; index++) {
			const ref = modelTurnRefs[index];
			const record = ref.apiCallId ? byCallId.get(ref.apiCallId) : undefined;
			if (!record) {
				continue;
			}
			byCallId.delete(ref.apiCallId!);
			const turn = events[ref.index] as IChatDebugModelTurnEvent;
			const totalTokens = record.inputTokens !== undefined ? record.inputTokens + (record.outputTokens ?? ref.outputTokens ?? 0) : undefined;
			events[ref.index] = { ...turn, inputTokens: record.inputTokens, cachedTokens: record.cacheReadTokens, totalTokens };
			const detail = resolved.get(ref.id);
			if (detail?.kind === 'modelTurn') {
				resolved.set(ref.id, { ...detail, inputTokens: record.inputTokens, cachedTokens: record.cacheReadTokens, totalTokens });
			}
			assignedInput += record.inputTokens ?? 0;
			assignedCache += record.cacheReadTokens ?? 0;
			if (record.turnId && !record.agentId && record.totalNanoAiu !== undefined) {
				costByTurn.set(record.turnId, { index: ref.index, cost: Math.max(record.totalNanoAiu, costByTurn.get(record.turnId)?.cost ?? 0) });
			}
			covered.add(index);
		}
		for (const { index, cost } of costByTurn.values()) {
			events[index] = { ...events[index] as IChatDebugModelTurnEvent, copilotUsageNanoAiu: cost };
			assignedAiu += cost;
		}
		return { covered, assignedInput, assignedCache, assignedAiu };
	}
	const assign = (ref: typeof modelTurnRefs[number], inputTokens: number | undefined, cachedTokens: number | undefined, copilotUsageNanoAiu: number | undefined) => {
		const turn = events[ref.index] as IChatDebugModelTurnEvent;
		const totalTokens = inputTokens !== undefined ? inputTokens + (ref.outputTokens ?? 0) : undefined;
		events[ref.index] = { ...turn, inputTokens, cachedTokens, totalTokens, copilotUsageNanoAiu };
		const detail = resolved.get(ref.id);
		if (detail?.kind === 'modelTurn') {
			resolved.set(ref.id, { ...detail, inputTokens, cachedTokens, totalTokens });
		}
	};

	// The sidecar and events.jsonl use DIFFERENT turn-id namespaces — the
	// sidecar keys on the backend request id (one id per user turn, shared by
	// its rounds) while events.jsonl keys on a per-turn round index that resets
	// each user turn — so they can't be correlated by id. Both streams are
	// chronological with one entry per model round, though, so correlate them
	// positionally, using the `outputTokens` both report as an alignment guard:
	// a ref whose output doesn't match the next record has no captured usage
	// (e.g. a sub-agent round, whose usage folds into the parent aggregate and
	// isn't recorded separately), so it's left blank and the record is kept for
	// the next ref.

	// Copilot AIU is cumulative per user turn (it resets each turn), so
	// attribute each turn's max only to its LAST captured round — the summed
	// per-turn total then stays exact. Turn boundaries are the runs of records
	// sharing a `turnId`.
	const aiuByRecordIndex = new Array<number | undefined>(usageRecords.length).fill(undefined);
	for (let start = 0; start < usageRecords.length;) {
		let end = start;
		while (end + 1 < usageRecords.length && usageRecords[end + 1].turnId === usageRecords[start].turnId) {
			end++;
		}
		let maxAiu = 0;
		for (let i = start; i <= end; i++) {
			maxAiu = Math.max(maxAiu, usageRecords[i].totalNanoAiu ?? 0);
		}
		if (maxAiu > 0) {
			aiuByRecordIndex[end] = maxAiu;
		}
		start = end + 1;
	}

	let recordIndex = 0;
	let assignedInput = 0;
	let assignedCache = 0;
	let assignedAiu = 0;
	const covered = new Set<number>();
	for (let refIdx = 0; refIdx < modelTurnRefs.length; refIdx++) {
		if (recordIndex >= usageRecords.length) {
			break;
		}
		const ref = modelTurnRefs[refIdx];
		const record = usageRecords[recordIndex];
		if (ref.outputTokens !== undefined && record.outputTokens !== undefined && ref.outputTokens !== record.outputTokens) {
			continue; // this ref has no captured usage record — leave it blank
		}
		const aiu = aiuByRecordIndex[recordIndex];
		assign(ref, record.inputTokens, record.cacheReadTokens, aiu);
		assignedInput += record.inputTokens ?? 0;
		assignedCache += record.cacheReadTokens ?? 0;
		assignedAiu += aiu ?? 0;
		covered.add(refIdx);
		recordIndex++;
	}
	return { covered, assignedInput, assignedCache, assignedAiu };
}

/** Session usage totals distributed across model turns. */
interface ISessionUsageTotals {
	/** Cumulative input tokens — only set when known from an exact source (`session.shutdown`). */
	readonly inputTokens?: number;
	/** Cumulative cache-read tokens — only set when known from an exact source. */
	readonly cacheReadTokens?: number;
	/** Cumulative Copilot AIU (nano). */
	readonly totalNanoAiu: number;
}

/**
 * Extracts session-cumulative usage from the last `session.shutdown` record.
 * Token totals are summed across `modelMetrics[*].usage`; AIU prefers the
 * top-level `totalNanoAiu`, falling back to the per-model sum. Returns
 * `undefined` only when there is no `session.shutdown` record (e.g. an active
 * session) — once a shutdown summary exists it is authoritative even when its
 * totals are zero, so the caller must not fall back to live usage.
 */
function extractSessionUsageTotals(records: readonly IAgentHostEventRecord[]): ISessionUsageTotals | undefined {
	let shutdown: IAgentHostEventRecord | undefined;
	for (const record of records) {
		if (record.type === 'session.shutdown') {
			shutdown = record; // keep the last one
		}
	}
	if (!shutdown) {
		return undefined;
	}

	let inputTokens = 0;
	let cacheReadTokens = 0;
	let perModelNanoAiu = 0;
	const modelMetrics = shutdown.data.modelMetrics;
	if (modelMetrics && typeof modelMetrics === 'object') {
		for (const metric of Object.values(modelMetrics as Record<string, unknown>)) {
			const entry = metric as Record<string, unknown> | undefined;
			const usage = entry?.usage as Record<string, unknown> | undefined;
			inputTokens += asNumber(usage?.inputTokens) ?? 0;
			cacheReadTokens += asNumber(usage?.cacheReadTokens) ?? 0;
			perModelNanoAiu += asNumber(entry?.totalNanoAiu) ?? 0;
		}
	}
	const totalNanoAiu = asNumber(shutdown.data.totalNanoAiu) ?? perModelNanoAiu;

	// A shutdown summary is authoritative even when its totals are zero: input /
	// cache are then known to be zero (not unknown), so returning the totals here
	// keeps the caller from falling back to live AIU for a finished session.
	return { inputTokens, cacheReadTokens, totalNanoAiu };
}

/** Splits `total` into `n` integer parts that sum exactly to `total`. */
function distributeEvenly(total: number, n: number): number[] {
	if (n <= 0) {
		return [];
	}
	const base = Math.floor(total / n);
	const parts = new Array<number>(n).fill(base);
	let remainder = total - base * n;
	for (let i = n - 1; remainder > 0; i--, remainder--) {
		parts[i] += 1;
	}
	return parts;
}

/** Parses a line-delimited JSON stream, skipping blank or malformed lines. */
export function parseJsonl(text: string): IAgentHostEventRecord[] {
	const records: IAgentHostEventRecord[] = [];
	appendJsonlRecords(text, records);
	return records;
}

/**
 * Parses each complete JSONL line in `text` and appends the well-formed
 * records to `records` (used for both full and incremental tail reads).
 */
function appendJsonlRecords(text: string, records: IAgentHostEventRecord[]): void {
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		try {
			const parsed = JSON.parse(trimmed);
			// Require the full envelope so the converter can read `record.*` and
			// `record.data.*` without guarding every access — including a string
			// `timestamp` (else `new Date(...)` yields `Invalid Date`), a
			// `string | null` `parentId`, and a non-array `data` object. A line
			// missing any of these is treated as malformed and skipped rather than
			// throwing downstream (which would drop the whole session's debug log).
			if (parsed && typeof parsed.type === 'string' && typeof parsed.id === 'string'
				&& typeof parsed.timestamp === 'string'
				&& (parsed.parentId === null || typeof parsed.parentId === 'string')
				&& parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
				records.push(parsed as IAgentHostEventRecord);
			}
		} catch {
			// Ignore partial trailing lines (common when reading a bounded head).
		}
	}
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function diffMillis(start: string, end: string): number | undefined {
	const a = new Date(start).getTime();
	const b = new Date(end).getTime();
	return isFinite(a) && isFinite(b) && b >= a ? b - a : undefined;
}

function stringifyPayload(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value === 'string') {
		return value;
	}
	try {
		return JSON.stringify(value, undefined, 2);
	} catch {
		return undefined;
	}
}

function truncate(value: string | undefined, max: number): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	return value.length > max ? value.slice(0, max) + '…' : value;
}

/** First non-empty line of a message, trimmed to a short single-line summary. */
function summarize(content: string): string {
	const firstLine = content.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
	return firstLine.length > 100 ? firstLine.slice(0, 100) + '…' : firstLine;
}
