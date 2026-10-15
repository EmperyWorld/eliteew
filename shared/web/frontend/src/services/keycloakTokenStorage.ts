/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist / read / clear OIDC tokens for the Keycloak SPA facade (`sessionStorage`
 * default; `localStorage` when SPA browser-persistence is on / `persistSession: true`).
 * This is **not** Keycloak login-form Remember Me (SSO cookie / 14d realm policy).
 *
 * Invariants:
 * - Default persistence is `session`; local only when profile allows and preference set.
 * - SPA checkbox ≠ IdP Remember Me (Continuity W2 / WEB-SSO-SESSION-CONTINUITY-CONTRACT).
 * - APK profile never touches desktop localStorage tokens (`profileAllowsLocalTokenStorage`).
 * - Storage keys come from `keycloakProfile` (web / apk / mobileEmbedded).
 * - Read prefers newest `savedAt` across local+session (stale local must not win over fresh session).
 * - Persist to one mode removes the twin key in the other mode.
 *
 * Related:
 * - `services/keycloak.ts` (public facade), `keycloakProfile.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`, `documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md`
 */

import {
	getProfilePersistencePrefKey,
	getProfileTokenStorageKey,
	profileAllowsLocalTokenStorage,
} from './keycloakProfile';

/** `local` — переживает перезапуск браузера; `session` — только вкладка (без «запомнить»). */
export type KeycloakTokenPersistence = 'local' | 'session';

export interface PersistedKeycloakTokens {
	token?: string;
	refreshToken?: string;
	idToken?: string;
	timeSkew?: number;
	savedAt: number;
	persistence?: KeycloakTokenPersistence;
}

/** Web-profile defaults (Vitest + docs); runtime keys via `getProfileTokenStorageKey`. */
export const KEYCLOAK_TOKEN_STORAGE_KEY = 'eliteew.keycloak.oidcTokens.v1';
export const KEYCLOAK_PERSISTENCE_PREF_KEY =
	'eliteew.keycloak.persistencePref.v1';

export function resolveTokenPersistence(
	persistSession?: boolean
): KeycloakTokenPersistence {
	if (!profileAllowsLocalTokenStorage()) {
		return 'session';
	}
	if (typeof persistSession === 'boolean') {
		return persistSession ? 'local' : 'session';
	}
	const prefKey = getProfilePersistencePrefKey();
	if (prefKey && typeof localStorage !== 'undefined') {
		try {
			const pref = localStorage.getItem(prefKey);
			if (pref === 'session' || pref === 'local') return pref;
		} catch {
			/* ignore */
		}
	}
	return 'session';
}

export function saveTokenPersistencePreference(
	mode: KeycloakTokenPersistence
): void {
	const prefKey = getProfilePersistencePrefKey();
	if (!prefKey || typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(prefKey, mode);
	} catch {
		/* private mode / quota */
	}
}

export function getTokenStorage(
	mode: KeycloakTokenPersistence
): Storage | undefined {
	if (typeof window === 'undefined') return undefined;
	return mode === 'local' ? localStorage : sessionStorage;
}

export function readRawTokenPayloadFromStorage(
	storage: Storage
): string | null {
	const tokenKey = getProfileTokenStorageKey();
	try {
		let raw = storage.getItem(tokenKey);
		if (!raw && storage === localStorage && profileAllowsLocalTokenStorage()) {
			const legacy = localStorage.getItem(
				'eliteew.androidWebView.keycloakTokens.v1'
			);
			if (legacy) {
				localStorage.setItem(tokenKey, legacy);
				localStorage.removeItem('eliteew.androidWebView.keycloakTokens.v1');
				raw = legacy;
			}
		}
		return raw;
	} catch {
		return null;
	}
}

export function readPersistedKeycloakTokens(options?: {
	allowAccessOnly?: boolean;
}): PersistedKeycloakTokens | null {
	const storages: KeycloakTokenPersistence[] = profileAllowsLocalTokenStorage()
		? ['local', 'session']
		: ['session'];
	let best: PersistedKeycloakTokens | null = null;
	let bestSavedAt = Number.NEGATIVE_INFINITY;
	for (const mode of storages) {
		const storage = getTokenStorage(mode);
		if (!storage) continue;
		try {
			const raw = readRawTokenPayloadFromStorage(storage);
			if (!raw) continue;
			const parsed = JSON.parse(raw) as PersistedKeycloakTokens;
			if (!parsed.token) continue;
			if (!parsed.refreshToken && !options?.allowAccessOnly) continue;
			const savedAt =
				typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt)
					? parsed.savedAt
					: 0;
			if (savedAt >= bestSavedAt) {
				bestSavedAt = savedAt;
				best = {
					...parsed,
					persistence: parsed.persistence ?? mode,
				};
			}
		} catch {
			try {
				storage.removeItem(getProfileTokenStorageKey());
			} catch {
				/* ignore */
			}
		}
	}
	return best;
}

export function persistKeycloakTokens(
	payload: PersistedKeycloakTokens,
	mode: KeycloakTokenPersistence
): void {
	const tokenKey = getProfileTokenStorageKey();
	const storage = getTokenStorage(mode);
	if (!storage) return;
	const other = profileAllowsLocalTokenStorage()
		? getTokenStorage(mode === 'local' ? 'session' : 'local')
		: undefined;
	try {
		storage.setItem(
			tokenKey,
			JSON.stringify({ ...payload, persistence: mode })
		);
		other?.removeItem(tokenKey);
		saveTokenPersistencePreference(mode);
	} catch {
		/* private mode / quota */
	}
}

export function clearPersistedKeycloakTokens(): void {
	const tokenKey = getProfileTokenStorageKey();
	for (const mode of (profileAllowsLocalTokenStorage()
		? ['local', 'session']
		: ['session']) as KeycloakTokenPersistence[]) {
		const storage = getTokenStorage(mode);
		if (!storage) continue;
		try {
			storage.removeItem(tokenKey);
		} catch {
			/* ignore */
		}
	}
	// FoFline / APK: scrub leftover localStorage token islands even when LS persist is banned.
	if (
		!profileAllowsLocalTokenStorage() &&
		typeof localStorage !== 'undefined'
	) {
		try {
			localStorage.removeItem(tokenKey);
			localStorage.removeItem('eliteew.keycloak.foflineNative.oidcTokens.v1');
			localStorage.removeItem(
				'eliteew.keycloak.foflineNative.oidcAuthState.v1'
			);
			localStorage.removeItem('eliteew.androidWebView.keycloakTokens.v1');
		} catch {
			/* ignore */
		}
	} else if (
		profileAllowsLocalTokenStorage() &&
		typeof localStorage !== 'undefined'
	) {
		try {
			localStorage.removeItem('eliteew.androidWebView.keycloakTokens.v1');
		} catch {
			/* ignore */
		}
	}
}
