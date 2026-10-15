/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared status chip helpers for Admin Workers panels.
 *
 * Invariants:
 * - online null → unknown (not offline).
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 */

export function onlineChipClass(online: boolean | null): string {
	if (online === true) return 'bg-emerald-500/20 text-emerald-200';
	if (online === false) return 'bg-rose-500/20 text-rose-200';
	return 'bg-slate-500/20 text-slate-300';
}

export function onlineLabelKey(
	online: boolean | null
):
	| 'adminWorkers.statusOnline'
	| 'adminWorkers.statusOffline'
	| 'adminWorkers.statusUnknown' {
	if (online === true) return 'adminWorkers.statusOnline';
	if (online === false) return 'adminWorkers.statusOffline';
	return 'adminWorkers.statusUnknown';
}
