/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * RFC 4180-style CSV field escaping for client-side export downloads.
 *
 * Invariants:
 * - Avoid `.replace(/"/g, '""')` inside template literals (React Compiler + Rolldown parse bug).
 *
 * Related:
 * - `pages/Admin/adminUsersCsvExport.ts`, `pages/MarketingCabinet/utils.ts`
 */

const CSV_QUOTE = String.fromCharCode(34);
const CSV_ESCAPED_QUOTE = CSV_QUOTE + CSV_QUOTE;

function csvFieldNeedsQuotes(value: string): boolean {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code === 34 || code === 44 || code === 10 || code === 13) {
			return true;
		}
	}
	return false;
}

/** Escape a string cell for CSV output. */
export function escapeCsvField(value: string): string {
	if (!csvFieldNeedsQuotes(value)) {
		return value;
	}
	return CSV_QUOTE + value.split(CSV_QUOTE).join(CSV_ESCAPED_QUOTE) + CSV_QUOTE;
}

/** Escape a directory/export cell (null → empty string). */
export function escapeCsvCell(
	value: string | number | boolean | null | undefined
): string {
	if (value == null) {
		return '';
	}
	return escapeCsvField(String(value));
}
