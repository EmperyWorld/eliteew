/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC PKCE authorization-state persistence (`sessionStorage`) and URL helpers
 * for reading/clearing the authorization callback (`?code=` / hash params).
 *
 * Invariants:
 * - Auth-state TTL is `OIDC_AUTH_STATE_TTL_MS`; expired state reads as null.
 * - Storage key comes from `keycloakProfile` (`getProfileAuthStateStorageKey`).
 * - Does not import `keycloak.ts` or `authSessionCoordinator`.
 *
 * Related:
 * - `services/keycloak.ts`, `keycloakProfile.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`
 */

import { INTENDED_PAGE_SESSION_KEY } from '../constants/storageKeys';
import { getShellPageIdForIntendedStorage } from '../utils/pageRouting';
import { getProfileAuthStateStorageKey } from './keycloakProfile';

export const OIDC_AUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OidcAuthorizationState {
	state: string;
	nonce: string;
	codeVerifier: string;
	redirectUri: string;
	savedAt: number;
	register?: boolean;
	/** Соответствует «Запомнить меня»: true → localStorage, false → sessionStorage. */
	persistSession?: boolean;
}

export function readOidcAuthorizationState(): OidcAuthorizationState | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(getProfileAuthStateStorageKey());
		if (!raw) return null;
		const parsed = JSON.parse(raw) as OidcAuthorizationState;
		if (
			!parsed.state ||
			!parsed.codeVerifier ||
			!parsed.redirectUri ||
			!parsed.nonce
		) {
			return null;
		}
		if (Date.now() - parsed.savedAt > OIDC_AUTH_STATE_TTL_MS) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function writeOidcAuthorizationState(
	state: OidcAuthorizationState
): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(
			getProfileAuthStateStorageKey(),
			JSON.stringify(state)
		);
	} catch {
		/* ignore */
	}
}

export function clearOidcAuthorizationState(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(getProfileAuthStateStorageKey());
	} catch {
		/* ignore */
	}
}

export function hasAuthParams(params: URLSearchParams): boolean {
	return params.has('code') || params.has('state') || params.has('error');
}

export function readAuthorizationResponseParams(): URLSearchParams | null {
	if (typeof window === 'undefined') return null;
	const search = new URLSearchParams(window.location.search);
	if (hasAuthParams(search)) return search;

	const hash = window.location.hash.startsWith('#')
		? window.location.hash.slice(1)
		: window.location.hash;
	if (!hash.includes('=')) return null;
	const hashParams = new URLSearchParams(hash);
	return hasAuthParams(hashParams) ? hashParams : null;
}

/** True while URL still carries OIDC callback (?code= / #code=) — App must not start a second login. */
export function hasPendingAuthorizationCallbackInUrl(): boolean {
	return readAuthorizationResponseParams() !== null;
}

export function resolveHashAfterOAuthCleanup(currentHash: string): string {
	if (typeof window !== 'undefined') {
		const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
		if (path.endsWith('/mobile-app') || path === '/mobile-app') {
			return '';
		}
	}
	const trimmed = currentHash.replace(/^#/, '').trim();
	if (trimmed && !hasAuthParams(new URLSearchParams(trimmed))) {
		return currentHash.startsWith('#') ? currentHash : `#${trimmed}`;
	}
	try {
		const intended =
			sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)?.trim() ||
			getShellPageIdForIntendedStorage();
		if (intended) {
			return `#/${intended.replace(/^\/+/, '')}`;
		}
	} catch {
		// ignore
	}
	return '#/desktop';
}

export function clearAuthorizationResponseFromUrl(): void {
	if (typeof window === 'undefined') return;
	const next = new URL(window.location.href);
	next.searchParams.delete('code');
	next.searchParams.delete('state');
	next.searchParams.delete('session_state');
	next.searchParams.delete('iss');
	next.searchParams.delete('error');
	next.searchParams.delete('error_description');
	next.searchParams.delete('error_uri');
	const hash = resolveHashAfterOAuthCleanup(next.hash);
	const nextPath = `${next.pathname}${next.search}${hash}`;
	window.history.replaceState({}, document.title, nextPath);
}
