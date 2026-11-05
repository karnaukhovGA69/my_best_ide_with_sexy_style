/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { getSingletonServiceDescriptors } from '../../../../platform/instantiation/common/extensions.js';
import { InstantiationService } from '../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IInlineCompletionsService, InlineCompletionsService } from '../../../browser/services/inlineCompletionsService.js';

suite('Inactive inline completion service', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('can be created by strict DI without telemetry, context keys, storage or UI services', () => {
		const instantiation = store.add(new InstantiationService(new ServiceCollection(), true));
		const service = store.add(instantiation.createInstance(InlineCompletionsService));
		assert.deepStrictEqual({ time: service.snoozeTimeLeft, snoozing: service.isSnoozing(), event: service.onDidChangeIsSnoozing === Event.None }, { time: 0, snoozing: false, event: true });
	});

	test('repeated snooze and completion calls create no timers or events', () => {
		const clock = sinon.useFakeTimers();
		try {
			const service = store.add(new InlineCompletionsService());
			const events: boolean[] = [];
			store.add(service.onDidChangeIsSnoozing(value => events.push(value)));
			for (const duration of [undefined, 0, 1, 300000, -1, Infinity, NaN]) {
				service.snooze(duration);
				service.setSnoozeDuration(duration ?? 300000);
				service.reportNewCompletion('fixture-completion-id');
				service.cancelSnooze();
			}
			clock.tick(600000);
			assert.deepStrictEqual({ time: service.snoozeTimeLeft, snoozing: service.isSnoozing(), events, timers: clock.countTimers() }, { time: 0, snoozing: false, events: [], timers: 0 });
		} finally {
			clock.restore();
		}
	});

	test('preserves the singleton contract without registering obsolete actions', () => {
		assert.deepStrictEqual({
			singleton: getSingletonServiceDescriptors().some(([id, descriptor]) => id === IInlineCompletionsService && descriptor.ctor === InlineCompletionsService),
			snooze: !!CommandsRegistry.getCommand('editor.action.inlineSuggest.snooze'),
			cancel: !!CommandsRegistry.getCommand('editor.action.inlineSuggest.cancelSnooze'),
		}, { singleton: true, snooze: false, cancel: false });
	});

	test('disposal and subsequent compatibility calls remain inert', () => {
		const service = store.add(new InlineCompletionsService());
		service.dispose(); service.dispose();
		service.snooze(); service.setSnoozeDuration(300000); service.reportNewCompletion('fixture-after-dispose'); service.cancelSnooze();
		assert.deepStrictEqual([service.snoozeTimeLeft, service.isSnoozing()], [0, false]);
	});
});
