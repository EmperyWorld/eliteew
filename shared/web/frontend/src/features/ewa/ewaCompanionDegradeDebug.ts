/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Env-gated console.debug for EWA companion best-effort UI fallbacks (fire-and-forget cleanup).
 *
 * Invariants:
 * - Enabled by default; set VITE_EWA_COMPANION_DEGRADE_DEBUG=0 to silence.
 * - Never throws; callers keep graceful UX fallbacks.
 *
 * Related:
 * - api/ewa_platform/companion/observability/degrade_log.py
 * - .cursor/rules/eliteew-strict-roast.mdc
 */

export function ewaCompanionDegradeDebugEnabled(): boolean {
	const raw = import.meta.env.VITE_EWA_COMPANION_DEGRADE_DEBUG;
	if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') {
		return false;
	}
	return true;
}

export function ewaCompanionDegradeDebug(
	context: string,
	detail: string,
	err?: unknown
): void {
	if (!ewaCompanionDegradeDebugEnabled()) {
		return;
	}
	const errSuffix =
		err instanceof Error ? err.message : err != null ? String(err) : '';
	const message = `[companion_degrade] context=${context} ${detail}${errSuffix ? ` err=${errSuffix}` : ''}`;
	console.debug(message, err ?? '');
}
