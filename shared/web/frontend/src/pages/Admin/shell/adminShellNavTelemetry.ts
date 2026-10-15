/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-session counters for Unified Admin section opens — source of truth independent
 * of logger level (prod defaults to WARN and drops debug/info).
 *
 * Invariants:
 * - `recordAdminShellSectionSelect` always increments; logging is best-effort.
 * - Snapshot keys are section ids only (no PII).
 *
 * Related:
 * - `pages/Admin/UnifiedAdminPage.tsx`
 * - `documentation/platform/UNIFIED-ADMIN-SHELL.md`
 */

import type { AdminSectionId } from './adminShellConfig';

export type AdminShellNavTelemetrySnapshot = {
	totalSelects: number;
	bySection: Readonly<Record<string, number>>;
};

const counts = new Map<string, number>();
let totalSelects = 0;

export function recordAdminShellSectionSelect(
	section: AdminSectionId,
	_meta?: { embedded?: boolean }
): number {
	const next = (counts.get(section) ?? 0) + 1;
	counts.set(section, next);
	totalSelects += 1;
	return next;
}

export function getAdminShellNavTelemetrySnapshot(): AdminShellNavTelemetrySnapshot {
	const bySection: Record<string, number> = {};
	for (const [id, count] of counts) {
		bySection[id] = count;
	}
	return { totalSelects, bySection };
}

/** Vitest isolation only — do not call from product UI. */
export function resetAdminShellNavTelemetryForTests(): void {
	counts.clear();
	totalSelects = 0;
}
