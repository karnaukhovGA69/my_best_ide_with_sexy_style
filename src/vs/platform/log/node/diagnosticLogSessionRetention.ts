/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { lstat, readdir, rm } from 'fs/promises';
import { basename, dirname, join } from '../../../base/common/path.js';

export const diagnosticLogSessionsMaxBytes = 100 * 1024 * 1024;
const maxAge = 7 * 86400000;
const recentActivityAge = 86400000;
const maxOldSessions = 9;
const maxEntries = 10000;
const maxDepth = 16;
const sessionName = /^\d{8}T\d{6}$/;

interface ISessionSnapshot {
	readonly name: string;
	readonly bytes: number;
	readonly modified: number;
	readonly device: number;
	readonly inode: number;
	readonly complete: boolean;
}

export interface IDiagnosticLogSessionCleanup {
	readonly removed: readonly string[];
	/** Incomplete or recently written sessions are preserved, even when over budget. */
	readonly preserved: readonly string[];
	/** Observed bytes only; an incomplete scan cannot establish a hard disk quota. */
	readonly remainingBytes: number;
}

/**
 * Bounds archived desktop diagnostics at startup. Never truncates live logs, follows
 * symlinks, or scans outside the timestamped siblings of the current log session.
 * Current/recent sessions take precedence over the budget; native writers retain
 * their own per-channel rotation limits.
 */
export async function pruneDiagnosticLogSessions(currentSessionPath: string, now = Date.now()): Promise<IDiagnosticLogSessionCleanup> {
	const currentSession = basename(currentSessionPath);
	const result = { removed: [] as string[], preserved: [] as string[], remainingBytes: 0 };
	// Custom --logsPath values must not cause cleanup of unrelated sibling folders.
	if (!sessionName.test(currentSession)) {
		return result;
	}
	const root = dirname(currentSessionPath);
	const rootStat = await lstat(root);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
		return result;
	}
	const currentStat = await lstat(currentSessionPath);
	if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) {
		return result;
	}

	let entriesLeft = maxEntries;
	async function snapshot(path: string, name: string): Promise<ISessionSnapshot> {
		let bytes = 0;
		let modified = 0;
		let device = 0;
		let inode = 0;
		let complete = true;
		async function visit(path: string, depth: number): Promise<void> {
			if (entriesLeft-- <= 0 || depth > maxDepth) {
				complete = false;
				return;
			}
			try {
				const stat = await lstat(path);
				modified = Math.max(modified, stat.mtimeMs);
				if (depth === 0) {
					device = stat.dev;
					inode = stat.ino;
				}
				if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (depth === 0 && !stat.isDirectory())) {
					complete = false;
				} else if (stat.isFile()) {
					bytes += stat.size;
				} else {
					for (const entry of await readdir(path)) {
						await visit(join(path, entry), depth + 1);
						if (entriesLeft <= 0) {
							complete = false;
							break;
						}
					}
				}
			} catch {
				// A racing writer or unreadable entry is a reason to preserve the session.
				complete = false;
			}
		}
		await visit(path, 0);
		return { name, bytes, modified, device, inode, complete };
	}

	const names = (await readdir(root)).filter(name => sessionName.test(name)).sort();
	// Account for current/recent sessions first if the bounded scan runs out of work.
	const sessions: ISessionSnapshot[] = [];
	for (const name of [...names].reverse()) {
		const session = await snapshot(join(root, name), name);
		sessions.push(session);
		result.remainingBytes += session.bytes;
	}
	let oldCount = names.filter(name => name < currentSession).length;
	for (const session of sessions.reverse()) {
		if (!session.complete || session.name >= currentSession || now - session.modified < recentActivityAge) {
			result.preserved.push(session.name);
			continue;
		}
		if (now - session.modified < maxAge && oldCount <= maxOldSessions && result.remainingBytes <= diagnosticLogSessionsMaxBytes) {
			continue;
		}
		const path = join(root, session.name);
		// Recheck the entire candidate so a newly written nested log protects it too.
		const latest = await snapshot(path, session.name);
		if (!latest.complete || latest.device !== session.device || latest.inode !== session.inode || latest.modified !== session.modified || latest.bytes !== session.bytes) {
			result.preserved.push(session.name);
			continue;
		}
		await rm(path, { recursive: true });
		result.removed.push(session.name);
		result.remainingBytes -= session.bytes;
		oldCount--;
	}
	return result;
}
