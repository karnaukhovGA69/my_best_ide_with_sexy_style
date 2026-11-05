/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IManagedHoverContent } from '../../../../../base/browser/ui/hover/hover.js';
import { IMarkdownString, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IChatSpeechToTextService } from './chatSpeechToTextService.js';

/** Inactive compatibility adapter; never renders progress for unavailable dictation. */
export class DictationDownloadRing extends Disposable {
	constructor(_container: HTMLElement, _speechToTextService: IChatSpeechToTextService) {
		super();
	}

	update(): void { }
}

export function getDictationDownloadHoverMarkdown(_service: Pick<IChatSpeechToTextService, 'currentBackend'>): IMarkdownString {
	return new MarkdownString(localize('chatStt.unavailable', "Dictation is unavailable in Myself IDE."));
}

export function getDictationDownloadHoverContent(service: Pick<IChatSpeechToTextService, 'currentBackend'>): IManagedHoverContent {
	const markdown = getDictationDownloadHoverMarkdown(service);
	return { markdown, markdownNotSupportedFallback: markdown.value };
}

export function getDictationPreparingLabel(_service: IChatSpeechToTextService): string {
	return localize('chatStt.unavailable', "Dictation is unavailable in Myself IDE.");
}
