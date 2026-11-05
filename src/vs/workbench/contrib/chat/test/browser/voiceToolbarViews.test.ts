/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IObservable } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { IMenuEntryActionViewItemOptions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { DictationActionViewItem } from '../../browser/speechToText/dictationActionViewItem.js';
import { DictationDownloadActionViewItem } from '../../browser/speechToText/dictationDownloadActionViewItem.js';
import { VoiceModeActionViewItem } from '../../browser/voiceClient/voiceModeActionViewItem.js';

suite('Standalone voice toolbar views unavailable', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const kind of ['dictation', 'download', 'voice'] as const) {
		test(`${kind} needs no services, renders nothing and cannot run commands`, () => {
			const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
			let calls = 0;
			const action = upcastPartial<MenuItemAction>({ id: 'test.voice', enabled: true, run: async () => { calls++; } });
			const unreadable = { get: () => { throw new Error('Input must not be read'); } };
			const options = new Proxy({} as IMenuEntryActionViewItemOptions, unreadable);
			const active = new Proxy({} as IObservable<boolean>, unreadable);
			const view = store.add(kind === 'dictation'
				? instantiation.createInstance(DictationActionViewItem, action, options, active)
				: kind === 'download'
					? instantiation.createInstance(DictationDownloadActionViewItem, action, options)
					: instantiation.createInstance(VoiceModeActionViewItem, action, options));
			const container = document.createElement('div');
			container.className = 'existing';
			container.innerHTML = '<input aria-label="Existing input">';
			const original = container.outerHTML;
			view.render(new Proxy({} as HTMLElement, unreadable));
			view.render(container);
			view.onClick();
			view.focus();
			view.blur();
			const event = new MouseEvent('click', { cancelable: true, bubbles: true });
			assert.strictEqual(container.dispatchEvent(event), true);
			assert.strictEqual(view.isEnabled(), false);
			assert.strictEqual(calls, 0);
			assert.strictEqual(container.outerHTML, original);
			view.dispose();
			assert.strictEqual(container.outerHTML, original);
		});
	}
});
