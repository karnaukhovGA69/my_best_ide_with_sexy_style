/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PanelAlignment, Position } from '../../../services/layout/browser/layoutService.js';

export const savedPanelLayoutPrefix = 'myself.savedPanelLayout/';

export interface SavedPanelPart {
	readonly visible: boolean;
	readonly containerId?: string;
}

/** A profile-local snapshot of the three workbench pane locations. */
export interface SavedPanelLayout {
	readonly version: 1;
	readonly name: string;
	readonly sidebar: SavedPanelPart;
	readonly panel: SavedPanelPart;
	readonly auxiliaryBar: SavedPanelPart;
	readonly panelPosition?: Position;
	readonly panelAlignment?: PanelAlignment;
}

export function layoutName(value: string): string | undefined {
	const name = value.trim().normalize('NFC');
	return name.length > 0 && name.length <= 64 && !/[\p{Cc}\p{Bidi_Control}]/u.test(name) ? name : undefined;
}

export function layoutStorageKey(name: string): string {
	return savedPanelLayoutPrefix + name.toLowerCase();
}

export function isContainerId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\s\p{Cc}\p{Bidi_Control}]/u.test(value);
}

function isPart(value: unknown): value is SavedPanelPart {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	const part = value as Partial<SavedPanelPart>;
	return typeof part.visible === 'boolean' && (part.containerId === undefined || (part.visible && isContainerId(part.containerId)));
}

function isLayout(value: unknown): value is SavedPanelLayout {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	const layout = value as Partial<SavedPanelLayout>;
	if (layout.version !== 1 || typeof layout.name !== 'string' || layoutName(layout.name) !== layout.name
		|| !isPart(layout.sidebar) || !isPart(layout.panel) || !isPart(layout.auxiliaryBar)) {
		return false;
	}
	if (!layout.panel.visible) {
		return layout.panelPosition === undefined && layout.panelAlignment === undefined;
	}
	return (layout.panelPosition === Position.LEFT || layout.panelPosition === Position.RIGHT
		|| layout.panelPosition === Position.TOP || layout.panelPosition === Position.BOTTOM)
		&& (layout.panelAlignment === 'left' || layout.panelAlignment === 'center'
			|| layout.panelAlignment === 'right' || layout.panelAlignment === 'justify');
}

/** Return only records belonging to this storage key and the current format. */
export function readLayout(key: string, rawValue: string | undefined): SavedPanelLayout | undefined {
	if (!key.startsWith(savedPanelLayoutPrefix) || !rawValue || rawValue.length > 2048) {
		return undefined;
	}
	try {
		const value: unknown = JSON.parse(rawValue);
		return isLayout(value) && layoutStorageKey(value.name) === key ? value : undefined;
	} catch {
		return undefined;
	}
}
