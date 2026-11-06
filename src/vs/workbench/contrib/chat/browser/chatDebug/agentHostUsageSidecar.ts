/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { type Customization } from '../../../../../platform/agentHost/common/state/sessionState.js';
import { agentModelCallMetaKey, readAgentModelCallDiagnostics, type IAgentModelCallDiagnostics } from '../../../../../platform/agentHost/common/meta/agentModelCallMeta.js';

/**
 * Directory (under the client's user data home) that holds the per-session
 * token-usage sidecar files. Kept separate from VS Code's other user-data
 * folders and never written into the CLI's `~/.copilot` tree.
 */
const USAGE_DIR = 'agentHostUsage';
const MAX_USAGE_BYTES = 2 * 1024 * 1024;

/**
 * One captured Copilot `ChatUsage` action, i.e. the usage report for a single
 * model call. Persisted as a line in the session's sidecar so per-turn/per-round
 * token metrics survive a VS Code restart (the reduced chat state keeps only the
 * last request's input/cache per turn, and `events.jsonl` only records
 * `outputTokens` until `session.shutdown`).
 */
export interface IAgentHostUsageRecord extends Partial<Omit<IAgentModelCallDiagnostics, 'schemaVersion'>> {
	readonly schemaVersion?: 2;
	readonly kind?: 'modelCall';
	readonly correlation?: 'exact' | 'unresolved';
	/** Turn the model call belongs to. */
	readonly turnId?: string;
	/** Model that served the call, if reported. */
	readonly model?: string;
	/** Input tokens for this single call. */
	readonly inputTokens?: number;
	/** Output tokens for this single call. */
	readonly outputTokens?: number;
	/** Cache-read tokens for this single call. */
	readonly cacheReadTokens?: number;
	/** Per-turn cumulative Copilot AIU (nano) at the time of this call. */
	readonly totalNanoAiu?: number;
	/** ISO timestamp when the client captured the action. */
	readonly ts: string;
}

/** Builds the sidecar URI for a session's usage records under `baseDir`. */
export function buildAgentHostUsageUri(baseDir: URI, rawSessionId: string): URI {
	return joinPath(baseDir, USAGE_DIR, `${sanitizeSessionId(rawSessionId)}.jsonl`);
}

/** Replaces characters that are unsafe in a file name so a raw id maps to one file. */
function sanitizeSessionId(rawSessionId: string): string {
	return rawSessionId.replace(/[^\w.-]/g, '_');
}

/**
 * Reads a session's usage sidecar. Returns the records in capture order,
 * skipping blank or malformed lines. Returns an empty array when the file does
 * not exist (e.g. a session that ran before capture shipped).
 */
export async function readAgentHostUsageRecords(fileService: IFileService, uri: URI): Promise<IAgentHostUsageRecord[]> {
	let text: string;
	try {
		const content = await fileService.readFile(uri, { limits: { size: MAX_USAGE_BYTES } });
		text = content.value.toString();
	} catch {
		return [];
	}
	const records: IAgentHostUsageRecord[] = [];
	for (const line of text.split('\n').slice(-2049)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		try {
			const parsed = JSON.parse(trimmed);
			if (parsed?.schemaVersion === 2) {
				const modelCall = readAgentModelCallDiagnostics({ _meta: { [agentModelCallMetaKey]: { ...parsed, schemaVersion: 1 } } });
				if (modelCall && typeof parsed.ts === 'string' && parsed.ts.length <= 64) {
					records.push({
						...modelCall, schemaVersion: 2, kind: 'modelCall', correlation: modelCall.turnId ? 'exact' : 'unresolved', ts: parsed.ts,
						totalNanoAiu: typeof parsed.totalNanoAiu === 'number' && Number.isFinite(parsed.totalNanoAiu) && parsed.totalNanoAiu >= 0 ? parsed.totalNanoAiu : undefined,
					});
				}
				continue;
			}
			if (parsed && parsed.schemaVersion === undefined && typeof parsed.turnId === 'string' && typeof parsed.ts === 'string') {
				records.push(parsed as IAgentHostUsageRecord);
			}
		} catch {
			// Skip a malformed/partial line rather than dropping the whole file.
		}
	}
	return records;
}

/**
 * Directory (under the client's user data home) that holds the per-session
 * customization snapshot sidecar files. Kept alongside — but separate from —
 * the usage sidecar, and never written into the CLI's `~/.copilot` tree.
 */
const CUSTOMIZATIONS_DIR = 'agentHostCustomizations';

/** Builds the sidecar URI for a session's customization snapshot under `baseDir`. */
export function buildAgentHostCustomizationsUri(baseDir: URI, rawSessionId: string): URI {
	return joinPath(baseDir, CUSTOMIZATIONS_DIR, `${sanitizeSessionId(rawSessionId)}.json`);
}

/**
 * Reads a session's persisted customization snapshot — the last
 * full-replacement `SessionCustomizationsChanged` payload captured live.
 * Returns `undefined` when the file is absent (e.g. a session that ran before
 * capture shipped) or malformed, so callers fall back to the live session
 * state rather than showing nothing.
 */
export async function readAgentHostCustomizationsSnapshot(fileService: IFileService, uri: URI): Promise<Customization[] | undefined> {
	let text: string;
	try {
		const content = await fileService.readFile(uri);
		text = content.value.toString();
	} catch {
		return undefined;
	}
	try {
		const parsed = JSON.parse(text);
		if (Array.isArray(parsed)) {
			return parsed as Customization[];
		}
	} catch {
		// Ignore a malformed/partial snapshot rather than throwing.
	}
	return undefined;
}
