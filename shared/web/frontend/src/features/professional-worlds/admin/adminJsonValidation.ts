/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JSON editor parsing helpers with field-level and line/column error feedback for admin forms.
 *
 * Invariants:
 * - Admin manifest/config fields must parse to JSON objects, not arrays or scalars.
 * - Syntax errors keep the original parser detail and add a best-effort line/column location.
 *
 * Related:
 * - src/features/professional-worlds/admin/adminI18n.ts
 */

import { adminText } from './adminI18n';

function positionToLineColumn(source: string, position: number) {
	const before = source.slice(0, Math.max(0, position));
	const lines = before.split('\n');
	return {
		line: lines.length,
		column: (lines.at(-1)?.length ?? 0) + 1,
	};
}

function parseErrorPosition(message: string): number | null {
	const match = message.match(/position (\d+)/i);
	return match ? Number.parseInt(match[1] ?? '', 10) : null;
}

export function parseJsonObjectField(
	value: string,
	label: string
): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value || '{}');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const position = parseErrorPosition(message);
		const location =
			position === null
				? { line: 1, column: 1 }
				: positionToLineColumn(value, position);
		throw new Error(
			adminText('validation.jsonSyntax', {
				label,
				line: location.line,
				column: location.column,
				message,
			})
		);
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(adminText('errors.fieldJsonObject', { label }));
	}
	return parsed as Record<string, unknown>;
}
