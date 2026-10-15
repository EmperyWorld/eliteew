/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced session expiry / redirect toasts shared by API client and AuthContext.
 *
 * Invariants:
 * - One terminal redirect toast per browser profile within debounce window (no tab spam).
 *
 * Related:
 * - services/auth/sessionAuthI18n.ts, services/api/client.ts, contexts/AuthContext.tsx
 */

import { toast } from 'sonner';
import { tSessionAuth } from './sessionAuthI18n';

const TERMINAL_SESSION_TOAST_DEBOUNCE_MS = 5_000;
let lastTerminalSessionToastAt = 0;

/** Test-only reset for debounce guard. */
export function resetSessionAuthToastStateForTests(): void {
	lastTerminalSessionToastAt = 0;
}

export function showSessionReplacedToast(displacedBy?: string | null): void {
	const winner = (displacedBy || '').trim().toLowerCase();
	if (winner === 'fofline') {
		toast.warning(tSessionAuth('sessionReplacedByFofline'));
		return;
	}
	if (winner === 'browser') {
		toast.warning(tSessionAuth('sessionReplacedByBrowser'));
		return;
	}
	toast.warning(tSessionAuth('sessionReplaced'));
}

export function showSessionReplaceCancelledToast(): void {
	toast.info(tSessionAuth('sessionReplaceCancelled'));
}

export function showSessionExpiredRedirectToast(): void {
	const now = Date.now();
	if (now - lastTerminalSessionToastAt < TERMINAL_SESSION_TOAST_DEBOUNCE_MS) {
		return;
	}
	lastTerminalSessionToastAt = now;
	toast.warning(tSessionAuth('loginRedirecting'));
}
