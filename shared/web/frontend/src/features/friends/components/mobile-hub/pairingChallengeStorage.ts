/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persists a still-valid mobile trusted-device pairing challenge across a desktop refresh.
 *
 * Invariants:
 * - Expired or malformed challenges are never returned to the UI.
 * - Only the pairing-specific sessionStorage key is cleared.
 *
 * Related:
 * - useMobileAppHubController.ts
 */

import type { MobilePairingChallengeResponse } from '@/services/mobileAppApi';

const PAIRING_CHALLENGE_KEY =
	'eliteew.mobile.trustedDevice.activePairingChallenge.v1';
export const PAIRING_PENDING_KEY =
	'eliteew.mobile.trustedDevice.pendingPairing.v1';

export type StoredPairingChallenge = {
	challenge: MobilePairingChallengeResponse;
	issuedAtMs: number;
	baselineDeviceIds: string[];
};

export function readStoredPairingChallenge(): StoredPairingChallenge | null {
	try {
		const raw = sessionStorage.getItem(PAIRING_CHALLENGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredPairingChallenge;
		const challenge = parsed?.challenge;
		if (!challenge?.pairing_code || !challenge?.expires_at) return null;

		const expiresAt = new Date(challenge.expires_at).getTime();
		if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
			sessionStorage.removeItem(PAIRING_CHALLENGE_KEY);
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function storePairingChallenge(
	payload: StoredPairingChallenge | null
): void {
	if (!payload) {
		sessionStorage.removeItem(PAIRING_CHALLENGE_KEY);
		return;
	}
	sessionStorage.setItem(PAIRING_CHALLENGE_KEY, JSON.stringify(payload));
}
