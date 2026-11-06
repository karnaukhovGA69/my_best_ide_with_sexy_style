/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IToolResult } from './languageModelToolsService.js';

export const IToolResultCompressor = createDecorator<IToolResultCompressor>('IToolResultCompressor');

/**
 * Result of running a {@link IToolResultFilter}.
 *
 * `text` is the new text to substitute back into the corresponding text part.
 * `compressed` is `true` if any compression actually happened — used purely
 * for telemetry / accounting.
 */
export interface IToolResultFilterOutput {
	readonly text: string;
	readonly compressed: boolean;
}

/**
 * A pure function that compresses a single text part of a tool result.
 *
 * Implementations MUST never make output worse than the input. If a filter
 * cannot improve a piece of text, it should return the original `text` and
 * `compressed: false`.
 */
export interface IToolResultFilter {
	readonly id: string;
	/** Tool ids this filter applies to. */
	readonly toolIds: readonly string[];
	/**
	 * Decide whether this filter wants to handle the result. May inspect tool
	 * input (e.g. for `run_in_terminal`, the command being run).
	 */
	matches(toolId: string, input: unknown): boolean;
	apply(text: string, input: unknown): IToolResultFilterOutput;
}

/**
 * Result of looking up a tool invocation in an {@link IToolResultCache}.
 */
export interface IToolResultCacheHit {
	/** The cached output content from the previous run. */
	readonly text: string;
	/** Wall-clock timestamp (ms since epoch) of when the cached entry was produced. */
	readonly timestamp: number;
}

/**
 * A read-through / write-through cache for tool results. Used to implement
 * "same as last run" response dedup for read-only, deterministic tool calls.
 *
 * The compressor invokes caches in this order on every `maybeCompress` call:
 *   1. `observe(toolId, input)` — caches may use this hook to invalidate
 *      sibling entries (e.g. a `git commit` clears `git status` / `git diff`).
 *   2. `lookup(toolId, input)` — if any cache returns a hit, the compressor
 *      substitutes the result with a single-line "same output as last run"
 *      reply and emits `cacheHit: true` telemetry.
 *   3. If no hit, after compression the compressor calls `record` so the
 *      cache can store the (possibly compressed) output.
 */
export interface IToolResultCache {
	readonly id: string;
	readonly toolIds: readonly string[];
	observe(toolId: string, input: unknown): void;
	lookup(toolId: string, input: unknown): IToolResultCacheHit | undefined;
	record(toolId: string, input: unknown, text: string): void;
}

export interface IToolResultCompressor {
	readonly _serviceBrand: undefined;
	registerFilter(filter: IToolResultFilter): void;
	registerCache(cache: IToolResultCache): void;
	/**
	 * Returns a possibly-compressed copy of `result`, or `undefined` if no
	 * compression was applied (caller should pass through the original).
	 */
	maybeCompress(toolId: string, input: unknown, result: IToolResult): IToolResult | undefined;
}
