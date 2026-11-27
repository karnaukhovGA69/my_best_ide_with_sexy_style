/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { marked } from '../../../src/vs/base/common/marked/marked.js';

export const discardedDocumentationElements = new Set('script style iframe object embed link meta base form input button select option textarea noscript svg math canvas video audio source picture'.split(' '));
const blockElements = new Set('address article aside blockquote br caption dd details div dl dt figcaption figure footer h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td th thead tfoot tr ul'.split(' '));
const resultLimit = 100;
const maxMarkupCharacters = 32 * 1024 * 1024;
const maxMarkupDelimiters = 256_000;
const snippetRadius = 56;

interface SearchDocument {
	index: number;
	title: string;
	format: 'html' | 'text' | 'markdown';
	selector?: string;
	text: string;
}

function normalize(value: string): string {
	return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Projects visible document text without attaching the parsed markup to the live document. */
function documentText(entry: SearchDocument): string {
	if (entry.format === 'text') { return normalize(entry.text); }
	const html = entry.format === 'markdown' ? marked.parse(entry.text, { async: false }) : entry.text;
	if (html.length > maxMarkupCharacters) { throw new Error('Documentation markup limit'); }
	let delimiters = 0;
	for (let index = html.indexOf('<'); index !== -1; index = html.indexOf('<', index + 1)) {
		if (++delimiters > maxMarkupDelimiters) { throw new Error('Documentation markup limit'); }
	}
	const template = document.createElement('template');
	template.innerHTML = html;
	const root = (entry.selector ? template.content.querySelector(entry.selector) : null) ?? template.content;
	const parts: string[] = [];
	let node: Node | null = root.firstChild;
	while (node && node !== root) {
		const tag = node instanceof Element ? node.localName : '';
		const discarded = discardedDocumentationElements.has(tag) || tag === 'title' || tag === 'head' || tag === 'template';
		if (node.nodeType === Node.TEXT_NODE) { parts.push(node.nodeValue ?? ''); }
		if (blockElements.has(tag)) { parts.push(' '); }
		if (tag === 'img') {
			const alt = (node as Element).getAttribute('alt');
			if (alt) { parts.push(`[${alt}]`); }
		}
		if (!discarded && node.firstChild) {
			node = node.firstChild;
			continue;
		}
		while (node && node !== root) {
			if (node instanceof Element && blockElements.has(node.localName)) { parts.push(' '); }
			if (node.nextSibling) { node = node.nextSibling; break; }
			node = node.parentNode;
		}
	}
	return normalize(parts.join(''));
}

function snippet(text: string, index: number, length: number): string {
	let start = Math.max(0, index - snippetRadius);
	let end = Math.min(text.length, index + length + snippetRadius);
	if ((text.charCodeAt(start) & 0xfc00) === 0xdc00) { start--; }
	if ((text.charCodeAt(end - 1) & 0xfc00) === 0xd800) { end++; }
	return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export function registerLibrarySearch(post: (message: object) => void): void {
	const pane = document.querySelector<HTMLDetailsElement>('#library-search')!;
	const form = document.querySelector<HTMLFormElement>('#library-search-form')!;
	const input = document.querySelector<HTMLInputElement>('#library-search-query')!;
	const cancel = document.querySelector<HTMLButtonElement>('#library-search-cancel')!;
	const status = document.getElementById('library-search-status')!;
	const coverage = document.getElementById('library-search-coverage')!;
	const results = document.getElementById('library-search-results')!;
	let nextId = 0;
	let current: { id: number; pattern: RegExp; batch: number; matches: number; skipped: number; done: boolean } | undefined;

	const messageText = (key: string, ...values: (number | string)[]) => status.dataset[key]!.replace(/\{(\d+)\}/gu, (_, index: string) => String(values[Number(index)]));
	function reset(): void {
		coverage.textContent = '';
		results.replaceChildren();
	}
	function stop(key?: string): void {
		if (!current) { return; }
		post({ type: 'librarySearchCancel', id: current.id });
		current = undefined;
		cancel.hidden = true;
		reset();
		status.textContent = key ? messageText(key) : '';
	}

	pane.addEventListener('toggle', () => {
		if (!pane.open && current && !current.done) { stop('cancelled'); }
	});
	input.addEventListener('input', () => stop());
	cancel.addEventListener('click', () => { stop('cancelled'); input.focus(); });
	form.addEventListener('submit', event => {
		event.preventDefault();
		const query = input.value.trim();
		const literal = normalize(query);
		if (!literal || query.length > input.maxLength) { return; }
		const pattern = new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu');
		current = { id: ++nextId, pattern, batch: 0, matches: 0, skipped: 0, done: false };
		reset();
		cancel.hidden = false;
		status.textContent = messageText('loading');
		post({ type: 'librarySearchStart', id: current.id, query });
	});

	window.addEventListener('message', async event => {
		const message = event.data;
		const search = current;
		if (!search || message?.id !== search.id) { return; }
		if (message.type === 'librarySearchInvalidated') {
			stop('invalidated');
			return;
		}
		if (message.type !== 'librarySearchBatch' || search.done || message.batch !== search.batch + 1) { return; }
		search.batch = message.batch;
		search.skipped += message.skipped;
		let deadline = performance.now() + 12;
		for (const entry of message.documents as SearchDocument[]) {
			if (performance.now() > deadline) {
				await new Promise(resolve => setTimeout(resolve, 0));
				if (current !== search) { return; }
				deadline = performance.now() + 12;
			}
			let text: string;
			try { text = documentText(entry); } catch { search.skipped++; continue; }
			const match = search.pattern.exec(text);
			if (!match || ++search.matches > resultLimit) { continue; }
			const item = document.createElement('li');
			const button = document.createElement('button');
			button.type = 'button';
			const title = document.createElement('strong');
			title.textContent = entry.title;
			const context = document.createElement('span');
			context.textContent = snippet(text, match.index, match[0].length);
			button.append(title, context);
			const index = entry.index;
			button.addEventListener('click', () => {
				if (current !== search) { return; }
				post({ type: 'librarySearchOpen', id: search.id, index });
				pane.open = false;
			});
			item.append(button);
			results.append(item);
		}
		search.done = message.done;
		cancel.hidden = search.done;
		const incomplete = search.skipped > 0 || message.catalogUnavailable;
		coverage.textContent = [
			search.skipped > 0 ? messageText('skipped', search.skipped) : '',
			message.catalogUnavailable ? messageText('catalogUnavailable') : '',
		].filter(Boolean).join(' ');
		if (search.done) {
			status.textContent = search.matches === 0 ? messageText(incomplete ? 'noScannedMatches' : 'noMatches')
				: messageText('matches', search.matches, Math.min(search.matches, resultLimit));
		} else {
			status.textContent = messageText('progress', message.offset, message.total);
			post({ type: 'librarySearchNext', id: search.id, batch: search.batch });
		}
	});
}
