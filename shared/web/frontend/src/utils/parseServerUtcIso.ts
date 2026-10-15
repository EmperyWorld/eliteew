/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse API timestamps stored as UTC-naive ISO strings (no ``Z`` suffix) into epoch ms.
 *
 * Invariants:
 * - Strings without a timezone offset are treated as UTC (EliteEW Postgres naive UTC).
 *
 * Related:
 * - hooks/useUgsStuckTaskAlerts.ts
 * - hooks/useUgsTaskTransitionNotifications.ts
 */

/** Parse server ISO datetime; naive values are UTC, not browser local. */
export function parseServerUtcIsoMs(
	iso: string | null | undefined
): number | undefined {
	if (!iso || typeof iso !== 'string') {
		return undefined;
	}
	const raw = iso.trim();
	if (!raw) {
		return undefined;
	}
	const hasTz =
		/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw) || /[+-]\d{4}$/.test(raw);
	const normalized = hasTz ? raw : `${raw}Z`;
	const t = Date.parse(normalized);
	return Number.isFinite(t) ? t : undefined;
}
