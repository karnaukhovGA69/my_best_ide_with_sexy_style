/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { ILanguageModelChatMetadataAndIdentifier } from '../../common/languageModels.js';
import { IVoiceDispatchResult, IVoiceModelReference, IVoiceToolCall } from '../../common/voiceClient/voiceClientService.js';

/**
 * Callbacks that require access to the chat widget or view state.
 * Implemented by the ChatViewPane to bridge UI concerns.
 */
export interface IVoiceToolDispatchDelegate {
	/** Accept input text in the current chat widget. Returns false if no widget available. */
	acceptInput(text: string): boolean;
	/** Get the resource URI of the currently active session. */
	getCurrentSessionResource(): Promise<URI | undefined>;
	/** Switch the view to a different session by resource URI. */
	switchToSession(resource: URI): Promise<boolean>;
	/** Resolve a session resource using the active frontend's authoritative session model. */
	resolveSessionResource?(sessionIdOrLabel: string): Promise<URI | undefined>;
	/** Get session information from the active frontend's authoritative session model. */
	getSessionInfo?(): Promise<string | undefined>;
	/** Set the session all subsequent voice turns and actions belong to. */
	setTargetSession(resource: URI, preserveVoice?: boolean): void;
	/** The explicit voice target, or the currently shown session when unpinned. */
	getTargetSessionResource(): URI | undefined;
	/** Select a model in the currently shown voice input. */
	selectModel(requestedModel: string): Promise<IVoiceModelSelectionResult>;
	/** Get the set of auto-approved session resource strings. */
	getAutoApprovedSessions(): Set<string>;
	/** Mark all current sessions as auto-approved. */
	addAllAutoApprovedSessions(): void;
	/** Remove a session from auto-approved set. */
	removeAutoApprovedSession(resource: string): void;
	/** Trigger an auto-approve check cycle. */
	triggerAutoApproveCheck(): void;
}

export interface IVoiceModelSelectionResult {
	readonly ok: boolean;
	readonly reason?: 'no_input' | 'model_not_found' | 'ambiguous_model' | 'selection_failed';
	readonly selected_model?: IVoiceModelReference;
	readonly available_models?: readonly IVoiceModelReference[];
}

function voiceModelReference(model: ILanguageModelChatMetadataAndIdentifier): IVoiceModelReference {
	return {
		identifier: model.identifier,
		name: model.metadata.name,
		vendor: model.metadata.vendor,
	};
}

function normalizeModelName(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Resolve only exact identifiers or unique normalized names; never guess among similar models. */
export function resolveVoiceModel(models: readonly ILanguageModelChatMetadataAndIdentifier[], requestedModel: string): IVoiceModelSelectionResult & { readonly identifier?: string } {
	const exactIdentifier = models.find(model => model.identifier === requestedModel);
	if (exactIdentifier) {
		return { ok: true, identifier: exactIdentifier.identifier, selected_model: voiceModelReference(exactIdentifier) };
	}

	const normalized = normalizeModelName(requestedModel);
	const exactMatches = models.filter(model => [
		model.metadata.name,
		model.metadata.id,
		model.metadata.family,
		`${model.metadata.name} ${model.metadata.vendor}`,
	].some(candidate => normalizeModelName(candidate) === normalized));
	if (exactMatches.length === 1) {
		return { ok: true, identifier: exactMatches[0].identifier, selected_model: voiceModelReference(exactMatches[0]) };
	}
	if (exactMatches.length > 1) {
		return { ok: false, reason: 'ambiguous_model', available_models: exactMatches.map(voiceModelReference) };
	}

	const related = normalized ? models.filter(model => [model.metadata.name, model.metadata.id, model.metadata.family]
		.some(candidate => normalizeModelName(candidate).includes(normalized) || normalized.includes(normalizeModelName(candidate)))) : [];
	return {
		ok: false,
		reason: related.length > 1 ? 'ambiguous_model' : 'model_not_found',
		available_models: (related.length > 0 ? related : models).slice(0, 10).map(voiceModelReference),
	};
}

export interface IVoiceToolDispatchService {
	readonly _serviceBrand: undefined;

	/**
	 * Compatibility hook for widget/UI callers. Ignored while voice tools are unavailable.
	 */
	setDelegate(delegate: IVoiceToolDispatchDelegate): void;

	/**
	 * Return an error without executing the tool call.
	 */
	dispatchToolCall(toolCall: IVoiceToolCall): Promise<string>;

	/**
	 * Refuse a backend-resolved response without changing the session.
	 *
	 * Separate from `dispatchToolCall` because it answers with a structured
	 * outcome rather than a string: the backend only speaks an acknowledgement
	 * for something it has actually observed, so "it landed" and "it didn't"
	 * have to be distinguishable.
	 */
	respondToSession(toolCall: IVoiceToolCall, token?: CancellationToken): Promise<IVoiceDispatchResult>;
}

export const IVoiceToolDispatchService = createDecorator<IVoiceToolDispatchService>('voiceToolDispatchService');

/** Compatibility adapter: voice tools are unavailable in this fork. */
export class VoiceToolDispatchService implements IVoiceToolDispatchService {

	declare readonly _serviceBrand: undefined;

	setDelegate(_delegate: IVoiceToolDispatchDelegate): void { }

	static getActionLabel(_name: string): string {
		return localize('agentsVoice.action.unavailable', "Voice tools are unavailable.");
	}

	async dispatchToolCall(_toolCall: IVoiceToolCall): Promise<string> {
		return 'error: voice tools are unavailable';
	}

	async respondToSession(_toolCall: IVoiceToolCall, _token?: CancellationToken): Promise<IVoiceDispatchResult> {
		return { ok: false, reason: 'unsupported' };
	}
}

registerSingleton(IVoiceToolDispatchService, VoiceToolDispatchService, InstantiationType.Delayed);
