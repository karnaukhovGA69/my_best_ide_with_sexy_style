/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
(() => {
	const api = (globalThis as typeof globalThis & { acquireVsCodeApi(): { postMessage(message: object): void } }).acquireVsCodeApi();
	const article = document.getElementById('document')!;
	const contents = document.getElementById('contents') as HTMLSelectElement;
	const back = document.getElementById('back') as HTMLButtonElement;
	const source = document.getElementById('source') as HTMLButtonElement;
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

	window.addEventListener('message', event => {
		const message = event.data;
		if (message?.type !== 'document' || typeof message.text !== 'string') { return; }
		document.getElementById('title')!.textContent = message.title;
		document.getElementById('metadata')!.textContent = message.metadata;
		document.getElementById('notice')!.textContent = message.notice;
		back.disabled = !message.back;
		source.hidden = !message.source;
		if (message.format === 'html') {
			const parsed = new DOMParser().parseFromString(message.text, 'text/html');
			const body = (typeof message.selector === 'string' ? parsed.querySelector(message.selector) : undefined) ?? parsed.body;
			article.replaceChildren(clean(body));
		} else {
			const pre = document.createElement('pre'); pre.className = 'plain-text'; pre.textContent = message.text; article.replaceChildren(pre);
		}
		contents.replaceChildren();
		let index = 0;
		for (const heading of article.querySelectorAll('h1, h2, h3')) {
			if (!heading.id) { heading.id = `doc-local-heading-${index++}`; }
			const option = document.createElement('option'); option.value = heading.id; option.textContent = heading.textContent; contents.append(option);
		}
		contents.hidden = contents.options.length === 0;
		document.getElementById('contents-label')!.hidden = contents.hidden;
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
	source.addEventListener('click', () => api.postMessage({ type: 'source' }));
	api.postMessage({ type: 'ready' });
})();
