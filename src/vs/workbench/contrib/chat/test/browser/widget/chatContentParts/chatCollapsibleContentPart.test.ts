/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $, addDisposableListener } from '../../../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { ITelemetryService } from '../../../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryServiceShape } from '../../../../../../../platform/telemetry/common/telemetryUtils.js';
import { workbenchInstantiationService } from '../../../../../../test/browser/workbenchTestServices.js';
import { ChatCollapsibleContentPart } from '../../../../browser/widget/chatContentParts/chatCollapsibleContentPart.js';
import { IChatContentPartRenderContext } from '../../../../browser/widget/chatContentParts/chatContentParts.js';

suite('ChatCollapsibleContentPart', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	class TestPart extends ChatCollapsibleContentPart {
		initialized = 0;
		protected override initContent(): HTMLElement {
			this.initialized++;
			return $('div', undefined, 'Preserved history');
		}
		protected override get collapsibleKind(): string { throw new Error('Analytics kind must not be collected'); }
		protected override get collapsibleInThinking(): boolean { throw new Error('Analytics placement must not be collected'); }
		hasSameContent(): boolean { return false; }
		disableExpansion(): void { this.setExpandable(false); }
	}

	function createPart(): TestPart {
		const instantiation = workbenchInstantiationService(undefined, store);
		instantiation.stub(ITelemetryService, new class extends NullTelemetryServiceShape {
			override publicLog2(): void { throw new Error('Expansion must not emit telemetry'); }
		}());
		const context = { contentIndex: 0, content: [] } as Partial<IChatContentPartRenderContext> as IChatContentPartRenderContext;
		return store.add(instantiation.createInstance(TestPart, 'History', context, undefined));
	}

	test('preserves lazy content, toggle events, and accessibility without collecting analytics', () => {
		const part = createPart();
		const node = part.domNode;
		let toggles = 0;
		store.add(addDisposableListener(node, ChatCollapsibleContentPart.userToggleEvent, () => toggles++));
		const button = node.querySelector<HTMLElement>('.monaco-button')!;
		assert.strictEqual(part.initialized, 0);
		button.click();
		assert.deepStrictEqual([part.expanded.get(), part.initialized, button.getAttribute('aria-expanded'), toggles], [true, 1, 'true', 1]);
		assert.ok(node.textContent?.includes('Preserved history'));
		button.click();
		assert.deepStrictEqual([part.expanded.get(), part.initialized, button.getAttribute('aria-expanded'), toggles], [false, 1, 'false', 2]);
		button.click();
		assert.deepStrictEqual([part.expanded.get(), part.initialized, toggles], [true, 1, 3]);
	});

	test('keeps a non-expandable status row inert', () => {
		const part = createPart();
		part.disableExpansion();
		const button = part.domNode.querySelector<HTMLElement>('.monaco-button')!;
		button.click();
		assert.deepStrictEqual([part.expanded.get(), part.initialized, button.tabIndex, button.getAttribute('aria-expanded')], [false, 0, -1, null]);
	});
});
