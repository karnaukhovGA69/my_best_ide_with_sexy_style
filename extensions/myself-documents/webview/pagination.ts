/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const a4WidthMm = 210;
const a4HeightMm = 297;
const pointsPerInch = 72;
const cssPixelsPerInch = 96;
const millimetersPerInch = 25.4;

function printableSize(pageMm: number, marginMm: number): number {
	// Chromium's PDF printer rounds paper up and margins down to points.
	// Blink lays out the resulting content box in whole CSS pixels.
	const paper = Math.ceil(pageMm / millimetersPerInch * pointsPerInch);
	const margin = Math.floor(marginMm / millimetersPerInch * pointsPerInch);
	return Math.floor((paper - 2 * margin) * cssPixelsPerInch / pointsPerInch);
}

export class DocumentPagination {
	private textMeasured: string | undefined;
	private frame: number | undefined;
	private metricsChanged = true;
	private showCaret = false;
	private printableHeight = printableSize(a4HeightMm, 20);
	private rowHeight = 0;
	private textHeight = 0;

	constructor(
		private readonly text: HTMLTextAreaElement,
		private readonly paper: HTMLElement,
		private readonly scrollArea: HTMLElement,
		private readonly stickyStatus: HTMLElement,
		private readonly mirror: HTMLElement,
		private readonly lineSample: HTMLElement,
		private readonly breaks: HTMLElement,
		private readonly shiftedBreak: HTMLElement,
	) { }

	setPageStyle(marginMm: number): void {
		this.printableHeight = printableSize(a4HeightMm, marginMm);
		this.paper.style.setProperty('--document-content-width', `${printableSize(a4WidthMm, marginMm)}px`);
		this.metricsChanged = true;
		this.update();
	}

	update(revealCaret = false): void {
		this.showCaret ||= revealCaret;
		if (this.frame === undefined && (this.metricsChanged || this.textMeasured !== this.text.value || this.showCaret)) {
			this.frame = requestAnimationFrame(() => this.render());
		}
	}

	private render(): void {
		this.frame = undefined;
		const reveal = this.showCaret;
		this.showCaret = false;
		const value = this.text.value;
		if (this.textMeasured !== value || this.metricsChanged) {
			this.textMeasured = value;
			this.mirror.textContent = value || '\u200b';
			this.rowHeight = this.lineSample.getBoundingClientRect().height / 2;
			this.textHeight = this.mirror.getBoundingClientRect().height;
			this.metricsChanged = false;
			if (this.rowHeight > 0) {
				this.renderBreaks();
			}
		}
		if (reveal && this.rowHeight > 0 && document.activeElement === this.text) {
			this.revealCaret(value);
		}
	}

	private renderBreaks(): void {
		const rowsPerPage = Math.floor(this.printableHeight / this.rowHeight);
		const rows = Math.max(1, Math.round(this.textHeight / this.rowHeight));
		const pageCount = Math.ceil(rows / rowsPerPage);
		// The plain PDF renderer uses widows:2 and orphans:2. Keep the final
		// two lines together when the last page would otherwise contain one.
		const shifted = pageCount > 1 && rows % rowsPerPage === 1;
		const regularBreakCount = pageCount - (shifted ? 2 : 1);
		const lastBreakRow = (pageCount - 1) * rowsPerPage - Number(shifted);
		const pageStep = rowsPerPage * this.rowHeight;
		this.paper.dataset.pageCount = String(pageCount);
		this.paper.dataset.rowsPerPage = String(rowsPerPage);
		this.paper.dataset.lastBreakRow = String(lastBreakRow);
		this.paper.style.setProperty('--document-content-height', `${Math.max(this.textHeight, this.printableHeight + lastBreakRow * this.rowHeight)}px`);
		this.breaks.hidden = regularBreakCount === 0;
		if (regularBreakCount) {
			this.breaks.style.top = `${pageStep}px`;
			this.breaks.style.height = `${(regularBreakCount - 1) * pageStep + 1}px`;
			this.breaks.style.setProperty('--page-step', `${pageStep}px`);
		}
		this.shiftedBreak.hidden = !shifted;
		if (shifted) {
			this.shiftedBreak.style.top = `${lastBreakRow * this.rowHeight}px`;
		}
	}

	private revealCaret(value: string): void {
		const index = this.text.selectionDirection === 'backward' ? this.text.selectionStart : this.text.selectionEnd;
		const mirrorRect = this.mirror.getBoundingClientRect();
		const textRect = this.text.getBoundingClientRect();
		const range = document.createRange();
		range.setStart(this.mirror.firstChild!, index);
		range.collapse(true);
		const position = range.getBoundingClientRect();
		const startsEmptyLastLine = index === value.length && value.endsWith('\n');
		const top = textRect.top + (startsEmptyLastLine ? this.textHeight : position.top - mirrorRect.top);
		const bottom = startsEmptyLastLine ? top + this.rowHeight : top + position.height;
		const left = startsEmptyLastLine ? textRect.left : textRect.left + position.left - mirrorRect.left;

		const gap = 8;
		const visibleTop = Math.max(0, this.stickyStatus.getBoundingClientRect().bottom) + gap;
		const visibleBottom = window.innerHeight - gap;
		if (bottom > visibleBottom) {
			window.scrollBy(0, bottom - visibleBottom);
		} else if (top < visibleTop) {
			window.scrollBy(0, top - visibleTop);
		}

		const area = this.scrollArea.getBoundingClientRect();
		if (left < area.left + gap) {
			this.scrollArea.scrollLeft += left - area.left - gap;
		} else if (left > area.right - gap) {
			this.scrollArea.scrollLeft += left - area.right + gap;
		}
	}
}
