/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

type FontFamily = 'serif' | 'sans-serif' | 'monospace';
interface PageOptions { size: 'A4'; fontFamily: FontFamily; fontSizePt: number; lineHeight: number; marginMm: number }
interface SavedState { base: string; draft: string; page: PageOptions; selectionStart: number; selectionEnd: number }
type HostMessage = { type: 'notice'; text: string } | { type: 'actionDone' } | { type: 'snapshot'; text: string; version: number; name: string; dirty: boolean; ack?: number; conflict?: boolean };
declare function acquireVsCodeApi(): { postMessage(message: object): void; getState(): SavedState | undefined; setState(state: SavedState): void };

function element<T extends HTMLElement>(id: string): T {
	return document.getElementById(id) as T;
}

(() => {
	const vscode = acquireVsCodeApi();
	const text = element<HTMLTextAreaElement>('text');
	const sync = element<HTMLElement>('sync');
	const notice = element<HTMLElement>('notice');
	const conflictPanel = element<HTMLElement>('conflict');
	const controls = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];
	const fields = { font: element<HTMLSelectElement>('font'), size: element<HTMLInputElement>('fontSize'), leading: element<HTMLInputElement>('lineHeight'), margin: element<HTMLInputElement>('margin') };
	const restored = vscode.getState();
	let base = '';
	let version = 0;
	let dirty = false;
	let initialized = false;
	let inFlight: { id: number; text: string } | undefined;
	let nextId = 0;
	let conflict = false;
	let pendingAction: string | undefined;
	let actionRunning = false;
	let composing = false;

	function pageOptions(): PageOptions {
		return { size: 'A4', fontFamily: fields.font.value as FontFamily, fontSizePt: Number(fields.size.value), lineHeight: Number(fields.leading.value), marginMm: Number(fields.margin.value) };
	}
	function validPage() {
		return Object.values(fields).every(field => field.checkValidity() && field.value !== '');
	}
	function persist() {
		vscode.setState({ base, draft: text.value, page: pageOptions(), selectionStart: text.selectionStart, selectionEnd: text.selectionEnd });
	}
	function resize() {
		text.style.height = 'auto';
		text.style.height = `${text.scrollHeight}px`;
	}
	function renderState() {
		conflictPanel.hidden = !conflict;
		const busy = actionRunning || Boolean(pendingAction);
		text.readOnly = busy;
		for (const control of controls) {
			control.disabled = !initialized || conflict || busy || (control.dataset.action === 'export' && !validPage());
		}
		sync.textContent = (conflict ? sync.dataset.conflict : inFlight || text.value !== base ? sync.dataset.pending : dirty ? sync.dataset.dirty : sync.dataset.saved) || '';
		persist();
		resize();
	}
	function applyPage() {
		const page = pageOptions();
		if (validPage()) {
			document.documentElement.style.setProperty('--document-font', { serif: 'Georgia, Times New Roman, serif', 'sans-serif': 'Arial, Helvetica, sans-serif', monospace: 'Courier New, monospace' }[page.fontFamily]);
			document.documentElement.style.setProperty('--document-size', `${page.fontSizePt}pt`);
			document.documentElement.style.setProperty('--document-leading', String(page.lineHeight));
			document.documentElement.style.setProperty('--document-margin', `${page.marginMm}mm`);
		}
		renderState();
	}
	function flush() {
		if (!initialized || conflict || inFlight || composing) {
			return;
		}
		if (text.value !== base) {
			inFlight = { id: ++nextId, text: text.value };
			vscode.postMessage({ type: 'edit', version, ...inFlight });
		} else if (pendingAction) {
			const action = pendingAction;
			pendingAction = undefined;
			actionRunning = true;
			vscode.postMessage({ type: 'action', action, version, page: pageOptions() });
		}
		renderState();
	}
	function requestAction(action: string) {
		if (!initialized || conflict || actionRunning || pendingAction) {
			return;
		}
		if (action === 'export' && !validPage()) {
			Object.values(fields).find(field => !field.checkValidity() || field.value === '')?.reportValidity();
			return;
		}
		pendingAction = action;
		flush();
	}
	function enterConflict() {
		conflict = true;
		pendingAction = undefined;
		actionRunning = false;
	}
	window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
		const message = event.data;
		if (message.type === 'notice') {
			notice.textContent = message.text;
			return;
		}
		if (message.type === 'actionDone') {
			actionRunning = false;
			renderState();
			return;
		}
		if (message.type !== 'snapshot' || message.version < version) {
			return;
		}
		element<HTMLElement>('name').textContent = message.name;
		dirty = message.dirty;
		if (!initialized) {
			base = message.text;
			text.value = message.text;
			if (restored && typeof restored.draft === 'string' && typeof restored.base === 'string' && restored.draft !== restored.base) {
				text.value = restored.draft;
				if (restored.base !== message.text) {
					enterConflict();
				}
			}
			initialized = true;
			text.disabled = false;
		} else if (inFlight) {
			if (message.ack !== inFlight.id) {
				// The acknowledgement includes the latest document version; never
				// overwrite typing with an intermediate change notification.
				return;
			}
			if (message.conflict || message.text !== inFlight.text) {
				enterConflict();
			}
			base = message.text;
			inFlight = undefined;
		} else {
			if (message.conflict || (text.value !== base && message.text !== base)) {
				enterConflict();
			} else if (!conflict && text.value === base) {
				const start = text.selectionStart;
				const end = text.selectionEnd;
				text.value = message.text;
				text.setSelectionRange(Math.min(start, text.value.length), Math.min(end, text.value.length));
			}
			base = message.text;
		}
		version = message.version;
		renderState();
		flush();
	});
	text.addEventListener('input', () => {
		notice.textContent = '';
		renderState();
		flush();
	});
	text.addEventListener('compositionstart', () => { composing = true; });
	text.addEventListener('compositionend', () => { composing = false; flush(); });
	text.addEventListener('beforeinput', event => {
		if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
			event.preventDefault();
			requestAction(event.inputType === 'historyUndo' ? 'undo' : 'redo');
		}
	});
	window.addEventListener('keydown', event => {
		if (!(event.metaKey || event.ctrlKey) || event.altKey) {
			return;
		}
		const key = event.key.toLowerCase();
		if (key === 's') {
			event.preventDefault(); requestAction('save');
		} else if (event.target === text && (key === 'z' || key === 'y')) {
			event.preventDefault(); requestAction(key === 'y' || event.shiftKey ? 'redo' : 'undo');
		} else if (key === 'f') {
			event.preventDefault(); element<HTMLInputElement>('query').focus();
		}
	});
	for (const control of controls) {
		control.addEventListener('click', () => requestAction(control.dataset.action!));
	}
	for (const field of Object.values(fields)) {
		field.addEventListener('input', applyPage);
	}
	element<HTMLElement>('useFile').addEventListener('click', () => {
		text.value = base; conflict = false; renderState(); text.focus();
	});
	element<HTMLElement>('keepDraft').addEventListener('click', () => {
		conflict = false; flush(); text.focus();
	});
	function findNext() {
		const query = element<HTMLInputElement>('query').value;
		if (!query) { return; }
		const source = text.value.toLocaleLowerCase();
		const needle = query.toLocaleLowerCase();
		let index = source.indexOf(needle, text.selectionEnd);
		if (index < 0) { index = source.indexOf(needle); }
		if (index >= 0) {
			text.focus(); text.setSelectionRange(index, index + query.length);
		}
	}
	element<HTMLElement>('findNext').addEventListener('click', findNext);
	element<HTMLInputElement>('query').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findNext(); } });
	window.addEventListener('resize', resize);
	if (restored?.page) {
		const page = restored.page;
		if (['serif', 'sans-serif', 'monospace'].includes(page.fontFamily)) { fields.font.value = page.fontFamily; }
		for (const [field, value] of [[fields.size, page.fontSizePt], [fields.leading, page.lineHeight], [fields.margin, page.marginMm]] as const) {
			if (typeof value === 'number' && Number.isFinite(value) && value >= Number(field.min) && value <= Number(field.max)) { field.value = String(value); }
		}
	}
	applyPage();
	vscode.postMessage({ type: 'ready' });
})();
