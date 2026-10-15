/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local Welcome / post-reset flags for Journey phase B (no Tauri side effects).
 *
 * Invariants:
 * - onboarding_completed persists across restarts; Welcome never returns after set.
 * - after_local_reset is one-shot (consume on read) for skip-Welcome after W5 wipe.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 Welcome persistence
 */

export const ONBOARDING_COMPLETED_KEY =
	'eliteew.journey.onboarding_completed' as const;
export const AFTER_LOCAL_RESET_KEY =
	'eliteew.journey.after_local_reset' as const;

export function readOnboardingCompleted(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === '1';
	} catch {
		return false;
	}
}

export function markOnboardingCompleted(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
	} catch {
		/* quota / private mode — Welcome may reappear once */
	}
}

/** W5 will set before app_restart; W3 consumes once so Welcome stays skipped. */
export function peekAfterLocalReset(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		return localStorage.getItem(AFTER_LOCAL_RESET_KEY) === '1';
	} catch {
		return false;
	}
}

export function consumeAfterLocalReset(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		const flag = localStorage.getItem(AFTER_LOCAL_RESET_KEY) === '1';
		if (flag) localStorage.removeItem(AFTER_LOCAL_RESET_KEY);
		return flag;
	} catch {
		return false;
	}
}

/** Test / W5 helper — do not call from retail UI except wipe success path. */
export function markAfterLocalResetForRestart(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(AFTER_LOCAL_RESET_KEY, '1');
	} catch {
		/* ignore */
	}
}
