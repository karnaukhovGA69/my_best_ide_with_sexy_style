/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, markAsSingleton } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * Spoken-word to symbol substitutions applied to terminal dictation. Ordered so
 * that multi-word phrases (e.g. "dollar sign") are matched before their single
 * word forms (e.g. "dollar"). Terminal dictation is mostly used to compose shell
 * commands, so punctuation names map to the literal characters a CLI expects.
 */
const symbolMap: [spoken: string, symbol: string][] = [
	['dollar sign', '$'],
	['double quote', '"'],
	['open paren', '('],
	['close paren', ')'],
	['open parenthesis', '('],
	['close parenthesis', ')'],
	['open bracket', '['],
	['close bracket', ']'],
	['open brace', '{'],
	['close brace', '}'],
	['open angle bracket', '<'],
	['close angle bracket', '>'],
	['greater than', '>'],
	['less than', '<'],
	['ampersand', '&'],
	['dollar', '$'],
	['percent', '%'],
	['asterisk', '*'],
	['star', '*'],
	['plus', '+'],
	['equals', '='],
	['exclamation', '!'],
	['forward slash', '/'],
	['slash', '/'],
	['backslash', '\\'],
	['pipe', '|'],
	['tilde', '~'],
	['caret', '^'],
	['at sign', '@'],
	['hashtag', '#'],
	['pound', '#'],
	['hash', '#'],
	['colon', ':'],
	['semicolon', ';'],
	['underscore', '_'],
	['hyphen', '-'],
	['dash', '-'],
	['dot', '.'],
	['period', '.'],
	['quote', '\''],
];

/** Applies terminal-specific normalization to dictated text. */
export function postProcessTerminalDictation(text: string): string {
	let input = text.replaceAll(/[.,?;!]/g, '');
	for (const [spoken, symbol] of symbolMap) {
		input = input.replace(new RegExp('\\b' + spoken + '\\b', 'gi'), symbol);
	}
	// Speech transcription capitalizes the first word of an utterance, which is
	// unexpected for shell commands (e.g. `Echo` instead of `echo`).
	input = input.replace(/^(\s*)([A-Z])/, (_, leading: string, letter: string) => leading + letter.toLowerCase());
	return input;
}

/** Inactive compatibility session; never accesses terminal instances or speech providers. */
export class TerminalVoiceSession extends Disposable {
	private static _instance: TerminalVoiceSession | undefined;

	static getInstance(_instantiationService: IInstantiationService): TerminalVoiceSession {
		return TerminalVoiceSession._instance ??= markAsSingleton(new TerminalVoiceSession());
	}

	async start(): Promise<void> { }
	stop(_send?: boolean): void { }
}
