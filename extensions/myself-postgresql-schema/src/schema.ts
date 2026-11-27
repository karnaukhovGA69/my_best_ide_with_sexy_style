/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SchemaError } from './target.js';

export const maxSchemaRows = 500;

// A bounded metadata query. The only interpolation is the fixed row limit.
export const schemaSql = `
BEGIN READ ONLY;
SET LOCAL search_path TO pg_catalog;
SET LOCAL statement_timeout TO '4000ms';
SELECT COALESCE(json_agg(json_build_array(schema_name, table_name, column_name, data_type)
    ORDER BY schema_name, table_name, ordinal_position), '[]'::json)
FROM (
    SELECT table_schema AS schema_name, table_name, column_name, data_type, ordinal_position
    FROM information_schema.columns
    WHERE table_schema <> 'information_schema' AND left(table_schema, 3) <> 'pg_'
    ORDER BY table_schema, table_name, ordinal_position
    LIMIT ${maxSchemaRows + 1}
) AS schema_columns;
ROLLBACK;`;

type SchemaRow = readonly [schema: string, table: string, column: string, type: string];

export interface SchemaSnapshot {
	readonly rows: readonly SchemaRow[];
	readonly truncated: boolean;
}

function isSchemaRow(row: unknown): row is SchemaRow {
	return Array.isArray(row) && row.length === 4 && row.every(cell => typeof cell === 'string');
}

/** Require the expected wire shape even when the endpoint returns arbitrary data. */
export function parseSchemaOutput(output: string): SchemaSnapshot {
	let value: unknown;
	try {
		value = JSON.parse(output);
	} catch {
		throw new SchemaError('invalid-result');
	}
	if (!Array.isArray(value) || value.length > maxSchemaRows + 1 || !value.every(isSchemaRow)) {
		throw new SchemaError('invalid-result');
	}
	return { rows: value.slice(0, maxSchemaRows), truncated: value.length > maxSchemaRows };
}

interface SchemaLabels {
	readonly title: string;
	readonly database: string;
	readonly headings: SchemaRow;
	readonly empty: string;
	readonly truncated: string;
}

function escapeText(value: string): string {
	return value.replaceAll(/[\p{Cc}\p{Bidi_Control}]/gu, ' ')
		.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;').replaceAll(/'/g, '&#39;');
}

/** Render text only, with an empty resource policy and no active content. */
export function renderSchema(snapshot: SchemaSnapshot, labels: SchemaLabels): string {
	const headings = labels.headings.map(heading => `<th scope="col">${escapeText(heading)}</th>`).join('');
	const rows = snapshot.rows.map(row => `<tr>${row.map(cell => `<td>${escapeText(cell)}</td>`).join('')}</tr>`).join('');
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeText(labels.title)}</title></head>
<body><h1>${escapeText(labels.title)}</h1><p>${escapeText(labels.database)}</p>
${rows ? `<table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>` : `<p>${escapeText(labels.empty)}</p>`}
${snapshot.truncated ? `<p>${escapeText(labels.truncated)}</p>` : ''}
</body></html>`;
}
