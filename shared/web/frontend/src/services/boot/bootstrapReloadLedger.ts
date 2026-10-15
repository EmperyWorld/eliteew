/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dependency-free pre-React reload ledger and hold detection.
 *
 * Invariants:
 * - Imports no API, maintenance, auth, i18n, React, or recovery UI modules.
 * - Automatic reload budget is persisted before the full application loads.
 * - Manual reload reasons never consume the automatic budget.
 *
 * Related:
 * - `main.tsx`
 * - `services/maintenance/reloadCircuitBreaker.ts`
 */

export const RELOAD_LEDGER_KEY = 'eliteew_reload_ledger_v1';
export const RELOAD_HOLD_KEY = 'eliteew_reload_hold_v1';

const MAX_AUTO_RELOADS = 2;
const LEDGER_TTL_MS = 15 * 60 * 1000;

type ReloadLedgerEntry = {
	reason: string;
	at: number;
};

type ReloadLedger = {
	startedAt: number;
	entries: ReloadLedgerEntry[];
};

export type BootstrapReloadState = {
	reason: string | null;
	holdActive: boolean;
	recentAutoReloads: number;
};

const MANUAL_RELOAD_REASONS = new Set([
	'manual_stale_bundle',
	'manual_stale_bundle_fallback',
	'manual_user',
]);

function emptyLedger(): ReloadLedger {
	return { startedAt: Date.now(), entries: [] };
}

function readLedger(): ReloadLedger {
	try {
		const raw = sessionStorage.getItem(RELOAD_LEDGER_KEY);
		if (!raw) {
			return emptyLedger();
		}
		const parsed = JSON.parse(raw) as ReloadLedger;
		if (!parsed || !Array.isArray(parsed.entries)) {
			return emptyLedger();
		}
		return {
			startedAt:
				typeof parsed.startedAt === 'number' ? parsed.startedAt : Date.now(),
			entries: parsed.entries.filter(
				(entry) =>
					typeof entry?.reason === 'string' &&
					typeof entry.at === 'number' &&
					Date.now() - entry.at < LEDGER_TTL_MS
			),
		};
	} catch {
		return emptyLedger();
	}
}

function writeLedger(ledger: ReloadLedger): void {
	try {
		sessionStorage.setItem(RELOAD_LEDGER_KEY, JSON.stringify(ledger));
	} catch {
		// Web Storage may be unavailable; reload safety degrades to this page load.
	}
}

export function isManualReloadReason(reason?: string | null): boolean {
	if (!reason) {
		return false;
	}
	return MANUAL_RELOAD_REASONS.has(reason) || reason.startsWith('manual_');
}

export function parseReloadReasonFromUrl(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return new URL(window.location.href).searchParams.get('_eliteew_reason');
}

export function stripReloadTrackingParamsFromUrl(): void {
	if (typeof window === 'undefined') {
		return;
	}
	const url = new URL(window.location.href);
	if (
		!url.searchParams.has('_eliteew_reload') &&
		!url.searchParams.has('_eliteew_reason')
	) {
		return;
	}
	url.searchParams.delete('_eliteew_reload');
	url.searchParams.delete('_eliteew_reason');
	window.history.replaceState(window.history.state, '', url.toString());
}

export function getRecentAutoReloadCount(): number {
	return readLedger().entries.length;
}

export function isReloadBudgetExceeded(): boolean {
	return getRecentAutoReloadCount() >= MAX_AUTO_RELOADS;
}

export function isReloadHoldActive(): boolean {
	try {
		return sessionStorage.getItem(RELOAD_HOLD_KEY) === '1';
	} catch {
		return false;
	}
}

export function setReloadHoldActive(): void {
	try {
		sessionStorage.setItem(RELOAD_HOLD_KEY, '1');
	} catch {
		// The full recovery layer remains available even without persistence.
	}
}

export function recordAutoReload(reason: string): void {
	if (isManualReloadReason(reason)) {
		return;
	}
	const ledger = readLedger();
	const now = Date.now();
	ledger.entries.push({ reason, at: now });
	if (ledger.entries.length === 1) {
		ledger.startedAt = now;
	}
	writeLedger(ledger);
	if (ledger.entries.length >= MAX_AUTO_RELOADS) {
		setReloadHoldActive();
	}
}

export function bootstrapReloadLedgerFromUrl(): BootstrapReloadState {
	const reason = parseReloadReasonFromUrl();
	const hadTrackingParam =
		typeof window !== 'undefined' &&
		(new URL(window.location.href).searchParams.has('_eliteew_reload') ||
			reason != null);

	if (reason && !isManualReloadReason(reason)) {
		recordAutoReload(reason);
	}
	if (hadTrackingParam) {
		stripReloadTrackingParamsFromUrl();
	}
	if (isReloadBudgetExceeded()) {
		setReloadHoldActive();
	}
	return {
		reason,
		holdActive: isReloadHoldActive(),
		recentAutoReloads: getRecentAutoReloadCount(),
	};
}

export function clearBootstrapReloadLedger(): void {
	try {
		sessionStorage.removeItem(RELOAD_HOLD_KEY);
		sessionStorage.removeItem(RELOAD_LEDGER_KEY);
	} catch {
		// Storage cleanup is best-effort after a verified healthy recovery.
	}
}
