/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { marked } from '../../../src/vs/base/common/marked/marked.js';

(() => {
	const api = (globalThis as typeof globalThis & { acquireVsCodeApi(): { postMessage(message: object): void } }).acquireVsCodeApi();
	const article = document.getElementById('document')!;
	const contents = document.getElementById('contents') as HTMLSelectElement;
	const back = document.getElementById('back') as HTMLButtonElement;
	const emptyBack = document.getElementById('empty-back') as HTMLButtonElement;
	const empty = document.getElementById('empty')!;
	const source = document.getElementById('source') as HTMLButtonElement;
	const reader = document.getElementById('reader')!;
	const find = document.getElementById('find') as HTMLFormElement;
	const query = document.getElementById('query') as HTMLInputElement;
	const findStatus = document.getElementById('find-status')!;
	const allowed = new Set('a abbr b blockquote br caption code col colgroup dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i kbd li main mark ol p pre s samp section small span strong sub summary sup table tbody td th thead tfoot tr ul var'.split(' '));
	const discarded = new Set('script style iframe object embed link meta base form input button select option textarea noscript svg math canvas video audio source picture'.split(' '));

	function clean(node: Node): Node {
		if (node.nodeType === Node.TEXT_NODE) { return document.createTextNode(node.textContent ?? ''); }
		const fragment = document.createDocumentFragment();
		if (!(node instanceof Element)) { return fragment; }
		const tag = node.tagName.toLowerCase();
		if (discarded.has(tag)) { return fragment; }
		if (tag === 'img') {
			// Keep accessible image descriptions without activating any document-provided URL.
			const alt = node.getAttribute('alt');
			if (alt) { const caption = document.createElement('span'); caption.className = 'image-description'; caption.textContent = `[${alt}]`; return caption; }
			return fragment;
		}
		const target = allowed.has(tag) ? document.createElement(tag) : fragment;
		if (target instanceof HTMLElement) {
			const id = node.getAttribute('id') || (tag === 'a' ? node.getAttribute('name') : null);
			if (id) { target.id = 'doc-' + id; }
			for (const attribute of ['colspan', 'rowspan', 'start']) {
				const value = node.getAttribute(attribute);
				if (value && /^\d{1,4}$/.test(value)) { target.setAttribute(attribute, value); }
			}
			if (tag === 'a') {
				const href = node.getAttribute('href');
				if (href) { target.setAttribute('href', '#'); target.dataset.link = href; }
			}
		}
		for (const child of node.childNodes) { target.appendChild(clean(child)); }
		return target;
	}

	function scroll(fragment: string): void {
		document.getElementById('doc-' + fragment)?.scrollIntoView({ block: 'start' });
	}

	function updateBack(available: boolean): void {
		back.disabled = !available;
		emptyBack.hidden = !available;
	}

	window.addEventListener('message', event => {
		const message = event.data;
		if (message?.type === 'backState' && typeof message.back === 'boolean') {
			updateBack(message.back === true);
			return;
		}
		if (message?.type === 'clear') {
			reader.hidden = true;
			empty.hidden = false;
			article.replaceChildren();
			contents.replaceChildren();
			document.getElementById('title')!.textContent = '';
			document.getElementById('metadata')!.textContent = '';
			document.getElementById('notice')!.textContent = '';
			query.value = '';
			findStatus.hidden = true;
			source.hidden = true;
			updateBack(message.back === true);
			return;
		}
		if (message?.type !== 'document' || typeof message.text !== 'string') { return; }
		empty.hidden = true;
		reader.hidden = false;
		document.getElementById('title')!.textContent = message.title;
		document.getElementById('metadata')!.textContent = message.metadata;
		document.getElementById('notice')!.textContent = message.notice;
		updateBack(message.back === true);
		source.hidden = !message.source;
		if (message.format === 'html' || message.format === 'markdown') {
			const html = message.format === 'markdown' ? marked.parse(message.text, { async: false }) : message.text;
			const parsed = new DOMParser().parseFromString(html, 'text/html');
			const body = (typeof message.selector === 'string' ? parsed.querySelector(message.selector) : undefined) ?? parsed.body;
			article.replaceChildren(clean(body));
		} else {
			const pre = document.createElement('pre'); pre.className = 'plain-text'; pre.textContent = message.text; article.replaceChildren(pre);
		}
		contents.replaceChildren();
		let index = 0;
		const headingIds = new Set<string>();
		for (const heading of article.querySelectorAll('h1, h2, h3')) {
			if (!heading.id && message.format === 'markdown') {
				const slug = (heading.textContent ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
				const base = 'doc-' + (slug || `local-heading-${index++}`);
				let id = base; let suffix = 1;
				while (headingIds.has(id) || document.getElementById(id)) { id = `${base}-${suffix++}`; }
				heading.id = id;
			}
			if (!heading.id) { heading.id = `doc-local-heading-${index++}`; }
			headingIds.add(heading.id);
			const option = document.createElement('option'); option.value = heading.id; option.textContent = heading.textContent; contents.append(option);
		}
		contents.hidden = contents.options.length === 0;
		document.getElementById('contents-label')!.hidden = contents.hidden;
		findStatus.hidden = true;
		window.scrollTo(0, 0);
		if (typeof message.fragment === 'string' && message.fragment) { scroll(message.fragment); }
	});
	article.addEventListener('click', event => {
		const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-link]') : null;
		if (!anchor) { return; }
		event.preventDefault();
		const href = anchor.dataset.link!;
		if (href.startsWith('#')) {
			try { scroll(decodeURIComponent(href.slice(1))); } catch { /* Ignore malformed fragments. */ }
		} else { api.postMessage({ type: 'link', href }); }
	});
	contents.addEventListener('change', () => document.getElementById(contents.value)?.scrollIntoView({ block: 'start' }));
	back.addEventListener('click', () => api.postMessage({ type: 'back' }));
	emptyBack.addEventListener('click', () => api.postMessage({ type: 'back' }));
	source.addEventListener('click', () => api.postMessage({ type: 'source' }));
	find.addEventListener('submit', event => {
		event.preventDefault();
		const text = query.value;
		if (!text) { return; }
		// Chromium's find scrolls to and selects each match, including text split across inline tags.
		const browser = window as Window & { find?(text: string, caseSensitive: boolean, backwards: boolean, wrapAround: boolean): boolean };
		query.blur();
		// Chromium searches input values too. Exclude the query from its own results.
		query.value = '';
		const matched = browser.find?.(text, false, false, true) ?? false;
		query.value = text;
		findStatus.textContent = matched ? '' : findStatus.dataset.noMatch!;
		findStatus.hidden = matched;
		if (!matched) { query.focus(); }
	});
	query.addEventListener('input', () => { findStatus.hidden = true; });
	window.addEventListener('keydown', event => {
		if (!reader.hidden && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
			event.preventDefault();
			event.stopImmediatePropagation();
			query.focus();
			query.select();
		}
	}, true);
	api.postMessage({ type: 'ready' });
})();
