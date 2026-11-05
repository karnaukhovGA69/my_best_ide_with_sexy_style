/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatInputOnboardingBanner, IChatInputOnboardingHostOptions } from '../widget/input/chatInputOnboarding.js';

export const SHOW_DICTATION_ONBOARDING_COMMAND = 'workbench.action.chat.showSpeechToTextIntroduction';
export const RESET_DICTATION_ONBOARDING_COMMAND = 'workbench.action.chat.resetSpeechToTextIntroduction';

const SYSTEM_DEFAULT_DEVICE_ID = '';
type DictationMediaDevices = Pick<MediaDevices, 'addEventListener' | 'removeEventListener' | 'dispatchEvent' | 'enumerateDevices' | 'getUserMedia'>;
type SwitchMicrophone = (deviceId: string) => Promise<AnalyserNode | undefined>;

export interface IMicrophoneOption {
	readonly deviceId: string;
	readonly label: string;
}

/**
 * The pickable microphones, with the physical system-default device identified
 * in its label instead of represented by a separate synthetic row.
 *
 * Drops the virtual `default`/`communications` entries (which duplicate a real
 * device under a synthetic id) and de-duplicates by `deviceId`, so one physical
 * microphone appears exactly once - the same normalization the "Select
 * Microphone" quick pick does, kept in one place so the two never disagree.
 */
export function buildMicrophoneOptions(devices: readonly MediaDeviceInfo[]): IMicrophoneOption[] {
	const seen = new Set<string>();
	const microphones: MediaDeviceInfo[] = [];
	for (const device of devices) {
		if (device.kind !== 'audioinput' || device.deviceId === 'default' || device.deviceId === 'communications') {
			continue;
		}
		if (seen.has(device.deviceId)) {
			continue;
		}
		seen.add(device.deviceId);
		microphones.push(device);
	}

	if (microphones.length === 0) {
		return [{
			deviceId: SYSTEM_DEFAULT_DEVICE_ID,
			label: localize('dictation.onboarding.systemDefault', "System default"),
		}];
	}

	const defaultDevice = devices.find(device => device.kind === 'audioinput' && device.deviceId === 'default');
	const defaultLabel = defaultDevice?.label.replace(/^(?:default|system default)\s*-\s*/i, '').trim();
	const defaultMicrophone = defaultDevice
		? microphones.find(device =>
			(defaultDevice.groupId && device.groupId === defaultDevice.groupId)
			|| (defaultLabel && device.label === defaultLabel)
		) ?? microphones[0]
		: undefined;

	const options: IMicrophoneOption[] = [];
	if (defaultDevice) {
		const label = defaultMicrophone?.label || defaultLabel;
		options.push({
			deviceId: SYSTEM_DEFAULT_DEVICE_ID,
			label: label
				? localize('dictation.onboarding.defaultDevice', "{0} (System default)", label)
				: localize('dictation.onboarding.systemDefault', "System default"),
		});
	}

	for (const device of microphones) {
		if (device === defaultMicrophone) {
			continue;
		}
		options.push({
			deviceId: device.deviceId,
			// Labels are empty until microphone permission has been granted at
			// least once; a truncated id is still better than a blank row.
			label: device.label || localize('dictation.onboarding.unknownDevice', "Unknown device ({0})", device.deviceId.slice(0, 8)),
		});
	}
	return options;
}

/**
 * Index of the microphone currently in use. Falls back to the system default
 * when the remembered device has been unplugged, which is exactly what dictation
 * itself does when it acquires the stream.
 */
export function indexOfMicrophone(options: readonly IMicrophoneOption[], deviceId: string): number {
	const index = options.findIndex(option => option.deviceId === deviceId);
	return index === -1 ? 0 : index;
}

export interface IDictationOnboardingBannerOptions {
	/** The element the card attaches itself to. */
	readonly container: HTMLElement;
	readonly onDismiss: () => void;
	/** Whether this manually opened card should also acquire a microphone preview. */
	readonly previewMicrophone: boolean;
	readonly source: 'automatic' | 'manual';
}

/** Inactive compatibility adapter: dictation onboarding is unavailable in this distribution. */
export class DictationOnboardingBanner extends Disposable implements IChatInputOnboardingBanner {
	constructor(_options: IDictationOnboardingBannerOptions, _mediaDevices: DictationMediaDevices | undefined) {
		super();
	}

	hasFocus(): boolean { return false; }
	canFocus(): boolean { return false; }
	focus(): void { }
	announce(): void { }
	setVisible(_visible: boolean): void { }
	async refreshMicrophones(_analyserNode?: AnalyserNode, _switchMicrophone?: SwitchMicrophone): Promise<void> { }
}

export const IDictationOnboardingService = createDecorator<IDictationOnboardingService>('dictationOnboardingService');

export interface IDictationOnboardingService {
	readonly _serviceBrand: undefined;
	readonly isVisible: boolean;
	registerHost(options: IChatInputOnboardingHostOptions): IDisposable;
	showIfNeeded(): boolean;
	show(): boolean;
	refreshMicrophones(analyserNode?: AnalyserNode, switchMicrophone?: SwitchMicrophone): void;
	reset(): void;
}

/** Keeps existing callers inert without accessing devices, storage, commands or telemetry. */
export class DictationOnboardingService extends Disposable implements IDictationOnboardingService {
	declare readonly _serviceBrand: undefined;
	readonly isVisible = false;

	registerHost(_options: IChatInputOnboardingHostOptions): IDisposable { return Disposable.None; }
	showIfNeeded(): boolean { return false; }
	show(): boolean { return false; }
	refreshMicrophones(_analyserNode?: AnalyserNode, _switchMicrophone?: SwitchMicrophone): void { }
	reset(): void { }
}

registerSingleton(IDictationOnboardingService, DictationOnboardingService, InstantiationType.Delayed);
