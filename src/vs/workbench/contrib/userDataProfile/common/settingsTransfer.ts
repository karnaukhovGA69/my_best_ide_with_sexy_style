/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { parse, ParseError } from '../../../../base/common/json.js';
import { applyEdits, setProperty } from '../../../../base/common/jsonEdit.js';
import { equals } from '../../../../base/common/objects.js';
import { localize } from '../../../../nls.js';

export const settingsTransferMaxBytes = 2 * 1024 * 1024;
export type SettingsValue = string | number | boolean | null | SettingsValue[] | ISettingsObject;
export interface ISettingsObject { [key: string]: SettingsValue }
export interface IPortableSettings {
	readonly settings: ISettingsObject;
	readonly omitted: readonly string[];
}

const languageOverride = /^(\[[^\[\]]+\])+$/;
const retiredSetting = /^(github(?:-authentication)?|chat|inlineChat|mcp|voice|telemetry|settingsSync|editor\.inlineSuggest)(\.|$)/i;
const safeTokenKeys = new Set(['editor.tokenColorCustomizations', 'editor.semanticTokenColorCustomizations', 'tokenColors']);

function isSensitiveKey(key: string): boolean {
	if (safeTokenKeys.has(key)) {
		return false;
	}
	const words = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
	return /(?:^|[._-])(?:password|passwd|secret|secrets|token|tokens|credential|credentials|authorization|auth|api[._-]?key|private[._-]?key)(?:$|[._-])/i.test(words);
}

function containsSensitiveValue(value: SettingsValue): boolean {
	if (typeof value === 'string') {
		return /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\bBearer\s+\S+|\bgh[pousr]_[A-Za-z0-9]+|\bgithub_pat_[A-Za-z0-9_]+|https?:\/\/[^\s/:@]+:[^\s/@]+@/i.test(value);
	}
	if (Array.isArray(value)) {
		return value.some(containsSensitiveValue);
	}
	return value !== null && typeof value === 'object' && Object.entries(value).some(([key, child]) => isSensitiveKey(key) || containsSensitiveValue(child));
}

function isSettingsValue(value: unknown, depth = 0): value is SettingsValue {
	if (depth > 32) {
		return false;
	}
	if (value === null || typeof value === 'string' || typeof value === 'boolean') {
		return true;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value);
	}
	if (Array.isArray(value)) {
		return value.every(child => isSettingsValue(child, depth + 1));
	}
	return typeof value === 'object' && Object.entries(value).every(([key, child]) => !['__proto__', 'prototype', 'constructor'].includes(key) && isSettingsValue(child, depth + 1));
}

export function parseSettingsFile(text: string): ISettingsObject {
	if (text.length > settingsTransferMaxBytes || VSBuffer.fromString(text).byteLength > settingsTransferMaxBytes) {
		throw new Error(localize('settingsTransfer.tooLarge', "The settings file exceeds the 2 MiB limit."));
	}
	const errors: ParseError[] = [];
	let value: unknown;
	try {
		value = parse(text.replace(/^\uFEFF/, ''), errors, { allowTrailingComma: true });
	} catch {
		throw new Error(localize('settingsTransfer.invalid', "Choose a valid settings.json file containing a JSON object."));
	}
	if (errors.length || !isSettingsValue(value) || !value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(localize('settingsTransfer.invalid', "Choose a valid settings.json file containing a JSON object."));
	}
	return value;
}

/** Filter both directions. SecretStorage and authentication accounts are never part of this format. */
export function portableSettings(text: string, isExcluded: (key: string) => boolean = () => false): IPortableSettings {
	const source = parseSettingsFile(text);
	const settings: ISettingsObject = Object.create(null);
	const omitted: string[] = [];
	const copy = (key: string, value: SettingsValue, target: ISettingsObject, prefix = '') => {
		if (isExcluded(key) || retiredSetting.test(key) || isSensitiveKey(key) || containsSensitiveValue(value)) {
			omitted.push(prefix + key);
		} else {
			target[key] = value;
		}
	};
	for (const [key, value] of Object.entries(source)) {
		if (languageOverride.test(key)) {
			if (!value || typeof value !== 'object' || Array.isArray(value)) {
				throw new Error(localize('settingsTransfer.invalidOverride', "Language settings must contain an object of settings."));
			}
			const overrides: ISettingsObject = Object.create(null);
			for (const [setting, entry] of Object.entries(value)) {
				copy(setting, entry, overrides, `${key}.`);
			}
			if (Object.keys(overrides).length) {
				settings[key] = overrides;
			}
		} else {
			copy(key, value, settings);
		}
	}
	return { settings, omitted };
}

/** Merge individual settings, including language overrides, preserving unrelated JSONC and comments. */
export function mergeSettingsFile(current: string, incoming: ISettingsObject): { content: string; changed: number } {
	const source = current.trim() ? current : '{}';
	const existing = parseSettingsFile(source);
	const eol = source.includes('\r\n') ? '\r\n' : '\n';
	const indentation = /\n([\t ]+)"/.exec(source)?.[1] ?? '\t';
	const formatting = { insertSpaces: !indentation.includes('\t'), tabSize: indentation.length, eol };
	let content = source;
	let changed = 0;
	for (const [key, value] of Object.entries(incoming)) {
		if (languageOverride.test(key) && value && typeof value === 'object' && !Array.isArray(value)) {
			const previous = existing[key];
			if (previous !== undefined && (!previous || typeof previous !== 'object' || Array.isArray(previous))) {
				throw new Error(localize('settingsTransfer.invalidExistingOverride', "Fix the invalid language settings in your current settings.json before importing."));
			}
			for (const [setting, entry] of Object.entries(value)) {
				if (!equals(previous?.[setting], entry)) {
					content = applyEdits(content, setProperty(content, [key, setting], entry, formatting));
					changed++;
				}
			}
		} else if (!equals(existing[key], value)) {
			content = applyEdits(content, setProperty(content, [key], value, formatting));
			changed++;
		}
	}
	// The merged file must obey the same limits as its inputs.
	parseSettingsFile(content);
	return { content, changed };
}
