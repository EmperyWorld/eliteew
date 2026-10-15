/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Break infinite auto-reload loops during backend restarts — ledger of `_eliteew_reason` navigations and hold mode until API is healthy.
 *
 * Invariants:
 * - At most two automatic hard reloads per outage window; further recovery is wait-only UI.
 * - Manual user reload (`manual_*` reasons) bypasses the hold budget.
 * - Hold clears only after maintenance inactive and `/api/health` succeeds.
 *
 * Related:
 * - `utils/staleBundleReload.ts`
 * - `contexts/MaintenanceContext.tsx`
 * - `mainFullApp.ts`
 */

import { publishUnplannedMaintenanceFromHttpError } from './recoveryNotificationGuard';
import {
	bootstrapReloadLedgerFromUrl,
	clearBootstrapReloadLedger,
	getRecentAutoReloadCount,
	isManualReloadReason,
	isReloadBudgetExceeded,
	isReloadHoldActive,
	RELOAD_HOLD_KEY,
	RELOAD_LEDGER_KEY,
	recordAutoReload as recordBootstrapAutoReload,
	setReloadHoldActive,
} from '../boot/bootstrapReloadLedger';
import {
	fetchMaintenanceStatusIfStale,
	getCurrentMaintenanceStatus,
} from './maintenanceState';

export const RECOVERY_HOLD_OVERLAY_ID = 'eliteew-recovery-hold-overlay';

export {
	getRecentAutoReloadCount,
	isManualReloadReason,
	isReloadBudgetExceeded,
	isReloadHoldActive,
	RELOAD_HOLD_KEY,
	RELOAD_LEDGER_KEY,
};

export function recordAutoReload(reason: string): void {
	recordBootstrapAutoReload(reason);
	if (isReloadBudgetExceeded()) {
		activateReloadHold('auto_reload_budget');
	}
}

export function activateReloadHold(source: string): void {
	setReloadHoldActive();
	if (!getCurrentMaintenanceStatus().active) {
		publishUnplannedMaintenanceFromHttpError(503, 30);
	}
	if (import.meta.env.DEV) {
		console.info('[reload-circuit] hold active:', source);
	}
}

/** Compatibility wrapper for runtime/tests; minimal entry uses the pure ledger directly. */
export function bootstrapReloadCircuitFromUrl(): void {
	const state = bootstrapReloadLedgerFromUrl();
	if (state.holdActive) {
		activateReloadHold('bootstrap');
	}
}

export function shouldBlockAutoReload(reason?: string): boolean {
	if (isManualReloadReason(reason)) {
		return false;
	}
	if (isReloadHoldActive() || isReloadBudgetExceeded()) {
		return true;
	}
	return false;
}

export async function isBackendReadyForRecovery(): Promise<boolean> {
	try {
		// Share single-flight + freshness window with bootstrap prefetch / provider poll.
		const status = await fetchMaintenanceStatusIfStale(8_000);
		if (status.active) {
			return false;
		}

		const healthRes = await fetch(`/api/health?t=${Date.now()}`, {
			cache: 'no-store',
		});
		return healthRes.ok;
	} catch {
		return false;
	}
}

export async function clearReloadCircuitWhenHealthy(): Promise<boolean> {
	if (!(await isBackendReadyForRecovery())) {
		return false;
	}
	clearBootstrapReloadLedger();
	return true;
}

/** Shared handler for recovery screens — returns true when backend is ready and hold cleared. */
export async function performRecoveryConnectionCheck(): Promise<boolean> {
	return clearReloadCircuitWhenHealthy();
}

/** Test-only reset. */
export function resetReloadCircuitForTests(): void {
	clearBootstrapReloadLedger();
}
