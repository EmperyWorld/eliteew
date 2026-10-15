/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Env-gated console.debug for EliteEW frontend best-effort fallbacks outside EWA companion.
 *
 * Invariants:
 * - Enabled by default; set VITE_ELITEEW_DEGRADE_DEBUG=0 to silence.
 * - Never throws; callers keep graceful UX fallbacks.
 *
 * Related:
 * - src/features/ewa/ewaCompanionDegradeDebug.ts
 * - .cursor/rules/eliteew-strict-roast.mdc
 */

export function eliteewDegradeDebugEnabled(): boolean {
	const raw = import.meta.env.VITE_ELITEEW_DEGRADE_DEBUG;
	if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') {
		return false;
	}
	return true;
}

export function eliteewDegradeDebug(
	context: string,
	detail: string,
	err?: unknown
): void {
	if (!eliteewDegradeDebugEnabled()) {
		return;
	}
	const errSuffix =
		err instanceof Error ? err.message : err != null ? String(err) : '';
	const message = `[eliteew_degrade] context=${context} ${detail}${errSuffix ? ` err=${errSuffix}` : ''}`;
	console.debug(message, err ?? '');
}
