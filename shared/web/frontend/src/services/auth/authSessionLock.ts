/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auth-teardown lock + post-teardown HTTP freeze until the next successful login sync.
 *
 * Invariants:
 * - begin/end pairs must balance for the in-flight teardown wave; only one wave at a time.
 * - sessionHttpFrozen stays true after teardown until clearAuthSessionHttpFreeze() on auth success.
 *
 * Related:
 * - authSessionCoordinator.ts, contexts/AuthContext.tsx, services/api/client.ts
 */

let teardownInFlight = false;
let sessionHttpFrozen = false;

export function beginAuthSessionTeardown(): boolean {
	if (teardownInFlight) {
		return false;
	}
	teardownInFlight = true;
	sessionHttpFrozen = true;
	return true;
}

export function endAuthSessionTeardown(): void {
	teardownInFlight = false;
}

/** Cleared on successful auth sync / login — allows new HTTP after session is valid again. */
export function clearAuthSessionHttpFreeze(): void {
	sessionHttpFrozen = false;
}

/** True while teardown runs or until the next authenticated session is established. */
export function isAuthSessionLocked(): boolean {
	return teardownInFlight || sessionHttpFrozen;
}

export function resetAuthSessionLockForTests(): void {
	teardownInFlight = false;
	sessionHttpFrozen = false;
}
