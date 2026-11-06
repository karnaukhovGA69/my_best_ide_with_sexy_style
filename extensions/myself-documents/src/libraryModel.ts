/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'node:path';

export interface LibraryEntry {
	id: string;
	group: string;
	title: string;
	file: string;
	source: string;
	format: 'html' | 'text';
	selector?: string;
}

export interface LibraryGroup { id: string; title: string; version: string; license: string }
export interface LibraryCatalog { groups: LibraryGroup[]; entries: LibraryEntry[] }
export const maxDocumentBytes = 16 * 1024 * 1024;

export function safeRelativeFile(file: string): boolean {
	return !!file && !path.posix.isAbsolute(file) && !file.includes('\\') && !file.includes(':')
		&& file.split('/').every(part => part !== '..' && part !== '.' && part !== '');
}

export function parseCatalog(text: string): LibraryCatalog {
	const value = JSON.parse(text) as LibraryCatalog;
	if (!Array.isArray(value.groups) || !Array.isArray(value.entries)) {
		throw new Error('Invalid documentation catalog');
	}
	const groups = new Set<string>();
	const ids = new Set<string>();
	for (const group of value.groups) {
		if (!group || typeof group.id !== 'string' || groups.has(group.id) || typeof group.title !== 'string' || typeof group.version !== 'string' || typeof group.license !== 'string') {
			throw new Error('Invalid documentation group');
		}
		groups.add(group.id);
	}
	for (const entry of value.entries) {
		if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || !groups.has(entry.group) || typeof entry.title !== 'string'
			|| typeof entry.file !== 'string' || !safeRelativeFile(entry.file) || typeof entry.source !== 'string'
			|| (entry.format !== 'html' && entry.format !== 'text') || (entry.selector !== undefined && typeof entry.selector !== 'string')) {
			throw new Error('Invalid documentation entry');
		}
		ids.add(entry.id);
	}
	return value;
}

/** Resolves links only to catalog entries; never grants a document arbitrary filesystem access. */
export function findLocalLink(current: LibraryEntry, href: string, entries: readonly LibraryEntry[]): { entry: LibraryEntry; fragment: string } | undefined {
	try {
		if (href.startsWith('#')) {
			return { entry: current, fragment: decodeURIComponent(href.slice(1)) };
		}
		const local = new URL(href, 'https://library.invalid/' + current.file);
		const file = decodeURIComponent(local.pathname.slice(1));
		const relative = local.origin === 'https://library.invalid' ? entries.find(entry => entry.file === file && entry.group === current.group) : undefined;
		const original = current.source ? new URL(href, current.source) : undefined;
		const match = relative ?? entries.find(entry => {
			if (!original || !entry.source) { return false; }
			const source = new URL(entry.source);
			return source.origin === original.origin && source.pathname === original.pathname;
		});
		if (match) {
			return { entry: match, fragment: decodeURIComponent((original?.hash || local.hash).slice(1)) };
		}
	} catch { /* An invalid or non-catalog link remains inert. */ }
	return undefined;
}
