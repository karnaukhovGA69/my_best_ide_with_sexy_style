/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Compatibility shapes for remaining chat view-model and fixture consumers.

export const enum ChatModelFeedbackSurveyStepKind {
	Choice = 'choice',
	Text = 'text',
}

export interface IChatModelFeedbackSurveyOption {
	readonly id: string;
	readonly label: string;
}

interface IChatModelFeedbackSurveyStepBase {
	readonly id: string;
	readonly title: string;
}

export interface IChatModelFeedbackSurveyChoiceStep extends IChatModelFeedbackSurveyStepBase {
	readonly kind: ChatModelFeedbackSurveyStepKind.Choice;
	readonly options: readonly IChatModelFeedbackSurveyOption[];
}

export interface IChatModelFeedbackSurveyTextStep extends IChatModelFeedbackSurveyStepBase {
	readonly kind: ChatModelFeedbackSurveyStepKind.Text;
	readonly placeholder?: string;
	readonly maxLength: number;
}

export type ChatModelFeedbackSurveyStep = IChatModelFeedbackSurveyChoiceStep | IChatModelFeedbackSurveyTextStep;

/**
 * Which responses a survey attaches to. An omitted or empty selector list means any.
 *
 * Selected and resolved models are matched separately on purpose. A survey about Auto routing
 * targets the selected model `auto`, and must not fire just because another request happened to
 * be routed to the same model.
 */
export interface IChatModelFeedbackSurveyMatch {
	readonly selectedModels: readonly string[];
	readonly resolvedModels: readonly string[];
	readonly modes: readonly string[];
	/** Agent host provider ids (e.g. `copilotcli`), or `none`. */
	readonly harnesses: readonly string[];
	readonly sessionTypes: readonly string[];
}

/**
 * Rules governing when the survey opens *by itself*.
 *
 * None of this applies to manual activation: clicking the feedback control is an explicit
 * request for the survey and always opens it. These rules exist only to keep unprompted
 * surfacing rare enough not to be a nuisance.
 */
export interface IChatModelFeedbackSurveyPrompt {
	/** Minimum days between two automatic prompts. `0` disables the cooldown. */
	readonly cooldownDays: number;
	/** How many times the survey may open itself within one chat session. */
	readonly maxPerSession: number;
	readonly chance: IChatModelFeedbackSurveyChance;
	readonly triggers: IChatModelFeedbackSurveyTriggers;
}

/**
 * A probability that ramps with usage. Every eligible response that does not prompt raises the
 * odds up to {@link IChatModelFeedbackSurveyChance.max}, so heavier users are asked sooner. The
 * odds reset once a prompt is shown.
 */
export interface IChatModelFeedbackSurveyChance {
	/** Probability applied to the first eligible response. `0` disables random prompting. */
	readonly initial: number;
	/** Added to the probability for each eligible response that did not prompt. */
	readonly increment: number;
	/** Ceiling the ramped probability cannot exceed. */
	readonly max: number;
}

/** Moments that prompt directly, without a probability roll. */
export interface IChatModelFeedbackSurveyTriggers {
	/** Fires when the user switches the picker off a model this survey matches. */
	readonly modelSwitchedAway: IChatModelFeedbackSurveyTrigger;
}

export interface IChatModelFeedbackSurveyTrigger {
	readonly enabled: boolean;
	/** Whether the trigger prompts even inside the cooldown window. */
	readonly bypassCooldown: boolean;
}

export interface IChatModelFeedbackSurveyConfig {
	readonly version: number;
	readonly id: string;
	readonly match: IChatModelFeedbackSurveyMatch;
	readonly prompt: IChatModelFeedbackSurveyPrompt;
	readonly steps: readonly ChatModelFeedbackSurveyStep[];
}
