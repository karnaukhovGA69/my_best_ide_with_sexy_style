/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import type { IChatModelFeedbackSurveyConfig } from '../../common/feedbackSurvey/chatModelFeedbackSurveyConfig.js';
import type { IChatResponseViewModel } from '../../common/model/chatViewModel.js';

/** Name of the experiment treatment carrying the survey payload. */
export const CHAT_MODEL_FEEDBACK_SURVEY_TREATMENT = 'chatModelFeedbackSurvey';

export const enum ChatModelFeedbackSurveyStatus {
	/** Available but not showing: only the feedback control is rendered. */
	Collapsed = 'collapsed',
	Open = 'open',
}

/** What caused the survey to open, recorded so the funnel can separate the two paths. */
export type ChatModelFeedbackSurveyOpenTrigger = 'manual' | 'chance' | 'modelSwitchedAway';

export interface IChatModelFeedbackSurveyState {
	readonly config: IChatModelFeedbackSurveyConfig;
	readonly instanceId: string;
	readonly status: ChatModelFeedbackSurveyStatus;
	/** Index into `config.steps` of the step currently being shown. */
	readonly stepIndex: number;
	/** Answers so far, keyed by step id. Choice steps store an option id, text steps the comment. */
	readonly answers: ReadonlyMap<string, string>;
	/** Uncommitted free text, preserved across the widget being recycled by virtualization. */
	readonly commentDraft: string;
	/** Whether this survey was submitted. Reopening it acknowledges rather than asks again. */
	readonly isSubmitted: boolean;
	/** What opened the survey, so the UI can take focus only when the user asked for it. */
	readonly openTrigger: ChatModelFeedbackSurveyOpenTrigger | undefined;
}

/** Identifies the response whose survey changed, without retaining its view model. */
export interface IChatModelFeedbackSurveyChangeEvent {
	readonly sessionResource: URI;
	readonly requestId: string;
}

export const IChatModelFeedbackSurveyService = createDecorator<IChatModelFeedbackSurveyService>('chatModelFeedbackSurveyService');

export interface IChatModelFeedbackSurveyService {
	readonly _serviceBrand: undefined;

	/** Fires when a response's survey state changes, so the row can re-render. */
	readonly onDidChangeSurveyState: Event<IChatModelFeedbackSurveyChangeEvent>;

	/**
	 * Fires when the configured survey changes, including when it first resolves. Rows rendered
	 * before that point carry no control until they re-render, so they listen for this.
	 */
	readonly onDidChangeConfiguration: Event<void>;

	/**
	 * The survey attached to a response, or `undefined` when the config does not apply to it.
	 *
	 * Presence depends only on the `match` rules and never on the prompting heuristics, so the
	 * control does not come and go between responses. Repeated calls return the same state, so a
	 * row scrolling back into view keeps its control and is not asked to prompt twice.
	 */
	getSurvey(response: IChatResponseViewModel): IChatModelFeedbackSurveyState | undefined;

	/**
	 * Opens the survey, or closes it when it is already showing. Manual opens are never rate
	 * limited, because the prompting rules only exist to pace surveys the user did not ask for.
	 */
	toggle(response: IChatResponseViewModel): void;

	/**
	 * Reports that the user moved the model picker from one model to another. Leaving a surveyed
	 * model for an unsurveyed one is the strongest signal that the model was wrong.
	 */
	notifyModelSwitchedAway(sessionResource: URI, fromModelId: string, toModelId: string): void;
	answerChoice(response: IChatResponseViewModel, stepId: string, optionId: string): void;
	submit(response: IChatResponseViewModel, comment?: string): void;
	dismiss(response: IChatResponseViewModel): void;
	/** Records in-progress free text without re-rendering, so it survives row recycling. */
	setCommentDraft(response: IChatResponseViewModel, comment: string): void;
}


/** Inert compatibility service while the remaining built-in chat callers are removed. */
export class ChatModelFeedbackSurveyService extends Disposable implements IChatModelFeedbackSurveyService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeSurveyState: Event<IChatModelFeedbackSurveyChangeEvent> = Event.None;
	readonly onDidChangeConfiguration: Event<void> = Event.None;

	getSurvey(_response: IChatResponseViewModel): IChatModelFeedbackSurveyState | undefined {
		return undefined;
	}

	toggle(_response: IChatResponseViewModel): void { }
	notifyModelSwitchedAway(_sessionResource: URI, _fromModelId: string, _toModelId: string): void { }
	answerChoice(_response: IChatResponseViewModel, _stepId: string, _optionId: string): void { }
	submit(_response: IChatResponseViewModel, _comment?: string): void { }
	dismiss(_response: IChatResponseViewModel): void { }
	setCommentDraft(_response: IChatResponseViewModel, _comment: string): void { }
}
