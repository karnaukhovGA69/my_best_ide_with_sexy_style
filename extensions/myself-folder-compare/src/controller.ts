/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type * as vscode from 'vscode';
import { compareFolders, defaultLimits, type ComparisonResult } from './comparison';

const scheme = 'myself-folder-compare-snapshot';
const viewId = 'myself.folderCompare.results';
const compareCommand = 'myself.folderCompare.compare';
const openCommand = 'myself.folderCompare.openDiff';
const maxPairs = 16;

interface Row {
	generation: string;
	label: string;
	description: string;
	tooltip: string;
	icon: string;
	preview: boolean;
	original: string;
	modified: string;
	bytes: number;
}

interface Snapshot {
	uri: vscode.Uri;
	content: string;
}

interface SnapshotPair {
	generation: string;
	item: Row;
	bytes: number;
	opening: boolean;
	entries: Snapshot[];
}

/** Render untrusted names as plain text, including icon syntax, controls and bidi characters. */
export function plain(value: string): string {
	return value.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`).replace(/\$\(/g, '\\$(');
}

function localFolder(uri: vscode.Uri, api: typeof vscode): boolean {
	return !api.env.remoteName && uri?.scheme === 'file' && !uri.authority && !uri.query && !uri.fragment && typeof uri.fsPath === 'string' && path.isAbsolute(uri.fsPath) && !/^[\\/]{2}/.test(uri.fsPath) && !uri.fsPath.includes('\0');
}

function text(buffer: Buffer | undefined): string | undefined {
	if (!buffer) {
		return '';
	}
	if (buffer.includes(0)) {
		return undefined;
	}
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
	} catch {
		return undefined;
	}
}

/** One installed optional extension, one passive result model and one readonly snapshot provider. */
export function activateWithApi(context: Pick<vscode.ExtensionContext, 'subscriptions'>, api: typeof vscode, scan = compareFolders) {
	const t = (message: string, ...args: Array<string | number | boolean>) => api.l10n.t(message, ...args);
	const changes = new api.EventEmitter<Row | undefined>();
	context.subscriptions.push(changes);
	let generation = randomUUID();
	let disposed = false;
	let busy = false;
	let opening = false;
	let rows: Row[] = [];
	let items = new Set<Row>();
	let title = t('Choose two folders to compare. No folders are scanned automatically.');
	const snapshots = new Map<string, Snapshot>();
	const pairs = new Set<SnapshotPair>();
	const pairByItem = new Map<Row, SnapshotPair>();
	let cancellation: vscode.CancellationTokenSource | undefined;
	const reasons = () => ({
		link: t('Symbolic link or junction skipped'), special: t('Special file skipped'), unreadable: t('Unavailable or unreadable'),
		notLocal: t('Only native local file paths are supported'), notDirectory: t('Not a directory'), unstable: t('Changed during comparison'),
		entries: t('Entry limit reached; remaining paths were not examined'), depth: t('Depth limit reached; this directory was not opened'),
		fileBytes: t('File byte limit reached; file was not read'), totalBytes: t('Total byte limit reached; file was not read'),
		time: t('Time limit reached; remaining paths were not examined'), unsupported: t('Safe file-open flags unavailable on this platform'),
		type: t('File and directory types differ; subtree was not opened'), directory: t('Directory'), binary: t('Binary or invalid UTF-8; text preview unavailable')
	});
	const removePair = (pair: SnapshotPair) => {
		pairs.delete(pair);
		pairByItem.delete(pair.item);
		for (const entry of pair.entries) {
			snapshots.delete(entry.uri.toString());
		}
	};
	const prune = () => {
		const open = new Set(api.workspace.textDocuments.map(document => document.uri.toString()));
		for (const pair of pairs) {
			if (!pair.opening && !pair.entries.some(entry => open.has(entry.uri.toString()))) {
				removePair(pair);
			}
		}
	};
	const unavailable = () => api.FileSystemError.FileNotFound(t('This comparison snapshot is unavailable. Compare the folders again.'));
	const contentProvider: vscode.TextDocumentContentProvider = {
		provideTextDocumentContent(uri: vscode.Uri) {
			const entry = !disposed && uri.scheme === scheme && !uri.authority && !uri.query && !uri.fragment ? snapshots.get(uri.toString()) : undefined;
			if (!entry) {
				throw unavailable();
			}
			return entry.content;
		}
	};
	const provider: vscode.TreeDataProvider<Row> = {
		onDidChangeTreeData: changes.event,
		getChildren(element?: Row) { return element ? [] : rows; },
		getTreeItem(element: Row) {
			const item = new api.TreeItem(element.label, api.TreeItemCollapsibleState.None);
			item.description = element.description;
			item.tooltip = element.tooltip;
			item.iconPath = new api.ThemeIcon(element.icon);
			if (items.has(element) && element.preview) {
				item.command = { command: openCommand, title: t('Open Snapshot Diff'), arguments: [element] };
			}
			return item;
		}
	};
	const update = (result: ComparisonResult, left: vscode.Uri, right: vscode.Uri) => {
		const labels = { added: t('Added on Right'), removed: t('Removed from Right'), changed: t('Changed'), skipped: t('Skipped') };
		const reasonLabels = reasons();
		const counts = { added: 0, removed: 0, changed: 0, skipped: 0 };
		rows = result.entries.map(entry => {
			counts[entry.status]++;
			const original = entry.original === undefined ? '' : text(entry.original);
			const modified = entry.modified === undefined ? '' : text(entry.modified);
			const preview = entry.status !== 'skipped' && !entry.reason && original !== undefined && modified !== undefined;
			const reason = entry.reason ? reasonLabels[entry.reason] : preview ? '' : reasonLabels.binary;
			return Object.freeze({ generation, label: plain(entry.path), description: labels[entry.status], tooltip: `${labels[entry.status]}\n${plain(entry.path)}${reason ? `\n${reason}` : ''}${entry.code ? ` (${entry.code})` : ''}`, icon: { added: 'diff-added', removed: 'diff-removed', changed: 'diff-modified', skipped: 'warning' }[entry.status], preview, original: original ?? '', modified: modified ?? '', bytes: (entry.original?.length ?? 0) + (entry.modified?.length ?? 0) });
		});
		items = new Set(rows);
		title = t('{0} → {1}. Added: {2}, removed: {3}, changed: {4}, skipped: {5}. {6}', plain(left.fsPath), plain(right.fsPath), counts.added, counts.removed, counts.changed, counts.skipped, result.incomplete ? t('Incomplete comparison') : t('Comparison complete'));
		view.message = title;
		if (!rows.length && !result.incomplete) {
			view.message = t('{0}\nAll examined file bytes are identical. This is a snapshot, not a live comparison.', title);
		}
		changes.fire(undefined);
	};
	const compare = async () => {
		if (disposed || busy || opening) {
			return;
		}
		busy = true;
		try {
			if (api.env.remoteName) {
				await api.window.showInformationMessage(t('Folder comparison is available only in a local window.'));
				return;
			}
			const left = await api.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: t('Choose Left Folder'), openLabel: t('Choose Left Folder') });
			if (disposed || !left?.length) {
				return;
			}
			if (left.length !== 1 || !localFolder(left[0], api)) {
				await api.window.showInformationMessage(t('Choose a local folder without a remote authority.'));
				return;
			}
			const right = await api.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: t('Choose Right Folder'), openLabel: t('Choose Right Folder') });
			if (disposed || !right?.length) {
				return;
			}
			if (right.length !== 1 || !localFolder(right[0], api)) {
				await api.window.showInformationMessage(t('Choose a local folder without a remote authority.'));
				return;
			}
			const button = t('Compare');
			const accepted = await api.window.showInformationMessage(t('Compare Selected Folders?'), { modal: true, detail: t('Left: {0}\nRight: {1}\nRead only. Limits: 4,000 entries across both folders, depth 8, 4 MiB per file, 32 MiB total raw content, 20 seconds between I/O operations. Links and errors are skipped. Existing open snapshots share the content budget.', plain(left[0].fsPath), plain(right[0].fsPath)) }, button);
			if (disposed || accepted !== button) {
				return;
			}
			prune();
			const retainedBytes = [...pairs].reduce((sum, pair) => sum + pair.bytes, 0);
			if (retainedBytes >= defaultLimits.totalBytes || pairs.size >= maxPairs) {
				await api.window.showInformationMessage(t('Close previous snapshot diffs before comparing more folders.'));
				return;
			}
			generation = randomUUID();
			const current = generation;
			items.clear();
			rows = [];
			view.message = t('Comparing selected folders…');
			changes.fire(undefined);
			cancellation = new api.CancellationTokenSource();
			const source = cancellation;
			const result = await api.window.withProgress({ location: api.ProgressLocation.Notification, title: t('Comparing Folders'), cancellable: true }, async (_progress, token) => {
				const listener = token.onCancellationRequested(() => source.cancel());
				try {
					return await scan(left[0].fsPath, right[0].fsPath, { limits: { totalBytes: defaultLimits.totalBytes - retainedBytes }, cancelled: () => source.token.isCancellationRequested || disposed || generation !== current });
				} finally {
					listener.dispose();
				}
			});
			if (disposed || source.token.isCancellationRequested || result.cancelled || generation !== current) {
				if (!disposed) {
					view.message = t('Comparison cancelled. No partial results were published.');
				}
				return;
			}
			update(result, left[0], right[0]);
			try {
				await api.commands.executeCommand(`${viewId}.focus`);
			} catch {
				await api.window.showInformationMessage(t('Open Folder Comparison in Explorer to view the results.'));
			}
		} catch {
			if (!disposed) {
				const message = t('Comparison failed. No new results are available.');
				view.message = message;
				await api.window.showErrorMessage(message);
			}
		} finally {
			cancellation?.dispose();
			cancellation = undefined;
			busy = false;
		}
	};
	const open = async (candidate: unknown) => {
		if (disposed || busy || opening || !items.has(candidate as Row)) {
			return;
		}
		const element = candidate as Row;
		if (element.generation !== generation || !element.preview) {
			return;
		}
		prune();
		if (pairs.size >= maxPairs && !pairByItem.has(element)) {
			await api.window.showInformationMessage(t('Close previous snapshot diffs before opening more.'));
			return;
		}
		opening = true;
		let pair = pairByItem.get(element);
		if (!pair) {
			const pairId = randomUUID();
			pair = { generation, item: element, bytes: element.bytes, opening: true, entries: [] };
			for (const [side, content] of [['left', element.original], ['right', element.modified]]) {
				const uri = api.Uri.from({ scheme, path: `/${generation}/${pairId}/${side}.txt` });
				const entry = { uri, content };
				pair.entries.push(entry);
				snapshots.set(uri.toString(), entry);
			}
			pairs.add(pair);
			pairByItem.set(element, pair);
		}
		pair.opening = true;
		try {
			await api.commands.executeCommand('vscode.diff', pair.entries[0].uri, pair.entries[1].uri, t('{0} — Folder Comparison Snapshot', element.label), { preview: false });
		} catch {
			if (!disposed) {
				await api.window.showErrorMessage(t('Unable to open the comparison snapshot.'));
			}
		} finally {
			pair.opening = false;
			opening = false;
			prune();
		}
	};
	const view = api.window.createTreeView(viewId, { treeDataProvider: provider, showCollapseAll: false });
	context.subscriptions.push(view);
	view.message = title;
	context.subscriptions.push(
		api.workspace.registerTextDocumentContentProvider(scheme, contentProvider),
		api.workspace.onDidCloseTextDocument(() => prune()),
		api.commands.registerCommand(compareCommand, compare),
		api.commands.registerCommand(openCommand, open),
		{ dispose() { disposed = true; cancellation?.cancel(); generation = randomUUID(); items.clear(); rows = []; snapshots.clear(); pairs.clear(); pairByItem.clear(); } });
	return { compare, open, provider, contentProvider };
}
