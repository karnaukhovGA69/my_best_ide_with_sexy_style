/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { runSchema } from './psql.js';
import type { SchemaSnapshot } from './schema.js';
import { inspectTarget, SchemaError, type LocalTarget } from './target.js';

interface SchemaInteraction {
	readonly isCurrent: () => boolean;
	readonly confirm: (target: LocalTarget) => PromiseLike<boolean>;
}

/** Revalidate the identity and workspace after confirmation and before starting psql. */
export async function inspectConfirmedSchema(
	picked: LocalTarget,
	signal: AbortSignal,
	interaction: SchemaInteraction,
	inspect = inspectTarget,
	execute = runSchema,
): Promise<SchemaSnapshot | undefined> {
	const canContinue = () => !signal.aborted && interaction.isCurrent();
	if (!canContinue()) {
		return undefined;
	}
	const candidate = await inspect(picked);
	if (!canContinue() || !(await interaction.confirm(candidate.target)) || !canContinue()) {
		return undefined;
	}
	const currentTarget = await inspect(picked);
	if (!canContinue()) {
		return undefined;
	}
	if (currentTarget.identity !== candidate.identity) {
		throw new SchemaError('target-changed');
	}
	const result = await execute(candidate.target, signal);
	return canContinue() ? result : undefined;
}
