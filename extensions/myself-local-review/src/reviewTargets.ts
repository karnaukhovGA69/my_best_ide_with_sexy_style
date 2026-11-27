/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import type { ReviewNote, ReviewRange } from './reviewStore';

export interface ReviewTarget {
	readonly uri: vscode.Uri;
	readonly resource: string;
	readonly root: string;
}

function isLocalUri(uri: vscode.Uri): boolean {
	return uri.scheme === 'file' && !uri.authority && !uri.query && !uri.fragment
		&& uri.path.startsWith('/') && !uri.path.startsWith('//') && !uri.path.includes('\0')
		&& (process.platform !== 'win32' || (/^\/[a-z]:\//i.test(uri.path) && !uri.path.includes('\\')))
		&& !uri.path.split('/').some(segment => segment === '..' || segment === '.');
}

export function reviewTarget(uri: vscode.Uri): ReviewTarget | undefined {
	if (!isLocalUri(uri)) {
		return undefined;
	}
	const root = vscode.workspace.getWorkspaceFolder(uri)?.uri;
	return root && isLocalUri(root) ? { uri, resource: uri.toString(), root: root.toString() } : undefined;
}

export function savedTarget(note: ReviewNote): ReviewTarget | undefined {
	try {
		const target = reviewTarget(vscode.Uri.parse(note.resource, true));
		return target?.resource === note.resource && target.root === note.root ? target : undefined;
	} catch {
		return undefined;
	}
}

export function storedRange(range: vscode.Range): ReviewRange {
	return [range.start.line, range.start.character, range.end.line, range.end.character];
}

export function noteRange(note: ReviewNote): vscode.Range {
	return new vscode.Range(...note.range);
}

/** Check a bounded selection and its context without opening another file. */
export function fingerprint(document: vscode.TextDocument, range: vscode.Range): string | undefined {
	if (range.end.line - range.start.line > 200 || !document.validateRange(range).isEqual(range)) {
		return undefined;
	}
	const first = Math.max(0, range.start.line - 1);
	const last = Math.min(document.lineCount - 1, range.end.line + 1);
	const context = new vscode.Range(first, 0, last, document.lineAt(last).range.end.character);
	if (document.offsetAt(context.end) - document.offsetAt(context.start) > 16_000) {
		return undefined;
	}
	return createHash('sha256').update(document.getText(context)).digest('hex');
}
