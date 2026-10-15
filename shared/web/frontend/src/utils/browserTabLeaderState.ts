/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Module-level browser tab leadership for axios interceptors (block gated REST until leader).
 *
 * Invariants:
 * - Embedded WebView clients bypass single-tab policy entirely.
 * - Non-leader browser tabs must not call gated API paths (including during election).
 * - Read-only unified content `GET …/download` and `GET …/thumbnail` stay allowed on follower tabs.
 * - `apiFetchWithAuth` blocks gated mutations/streaming on followers; read-only GET/HEAD/OPTIONS pass through.
 *
 * Related:
 * - `contexts/BrowserTabLeaderProvider.tsx`, `services/api/client.ts`
 */

/** Shared reject/cancel token for axios and `apiFetchWithAuth` follower gate. */
export const FOLLOWER_TAB_PASSIVE_MODE = 'follower_tab_passive_mode';

const READ_ONLY_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

import type { BrowserTabLeadershipRole } from '@/pages/Desktop/utils/desktopRealtimeLeader';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';

let currentRole: BrowserTabLeadershipRole = 'leader';
let singleTabPolicyEnabled = !isEmbeddedEliteEWClient();

export function getBrowserTabLeaderRole(): BrowserTabLeadershipRole {
	return currentRole;
}

export function setBrowserTabLeaderRole(role: BrowserTabLeadershipRole): void {
	currentRole = role;
}

export function setSingleTabPolicyEnabled(enabled: boolean): void {
	singleTabPolicyEnabled = enabled;
}

export function isSingleTabPolicyEnabled(): boolean {
	return singleTabPolicyEnabled;
}

const CONTENT_MEDIA_DOWNLOAD_RE =
	/^\/api\/v1\/content\/[0-9a-f-]{36}\/(download|thumbnail)$/i;

/** Desktop/admin REST paths blocked on non-leader browser tabs. */
function stripOriginFromApiPath(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	try {
		if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
			const url = new URL(trimmed);
			return `${url.pathname}${url.search}`;
		}
	} catch {
		/* fall through to raw path */
	}
	return trimmed;
}

export function normalizeSingleTabApiPath(
	path: string,
	baseURL: string = ''
): string {
	const rawPath = stripOriginFromApiPath(path);
	if (!baseURL.trim() || rawPath.startsWith('/api/')) {
		return rawPath;
	}
	const rawBase = stripOriginFromApiPath(baseURL);
	if (!rawBase) {
		return rawPath;
	}
	return `${rawBase.replace(/\/+$/, '')}/${rawPath.replace(/^\/+/, '')}`;
}

export function isSingleTabGatedApiPath(
	path: string,
	method: string = 'GET',
	baseURL: string = ''
): boolean {
	const p = normalizeSingleTabApiPath(path, baseURL).split('?')[0] ?? path;
	if (!p.startsWith('/api/v1/')) {
		return false;
	}
	const verb = method.toUpperCase();
	// Read-only media fetches must work on the tab that shows the player/preview.
	if (verb === 'GET' && CONTENT_MEDIA_DOWNLOAD_RE.test(p)) {
		return false;
	}
	const gatedPrefixes = [
		'/api/v1/desktop/',
		'/api/v1/gaf-chat/',
		'/api/v1/ewa/',
		'/api/v1/ugs/',
		'/api/v1/product-desktop/',
		'/api/v1/professional-worlds/',
		'/api/v1/friends/',
		'/api/v1/content',
		'/api/v1/profile/me',
	];
	return gatedPrefixes.some((prefix) => p.startsWith(prefix));
}

export function shouldBlockSingleTabApi(
	path: string,
	method: string = 'GET',
	baseURL: string = ''
): boolean {
	if (!singleTabPolicyEnabled) {
		return false;
	}
	if (getBrowserTabLeaderRole() === 'leader') {
		return false;
	}
	return isSingleTabGatedApiPath(path, method, baseURL);
}

/**
 * Leader gate for `apiFetchWithAuth`: block gated mutations/streaming on follower tabs;
 * allow read-only GET/HEAD/OPTIONS (including SSE subscribe GET if used).
 */
export function shouldBlockSingleTabApiMutation(
	path: string,
	method: string = 'GET',
	baseURL: string = ''
): boolean {
	const verb = method.toUpperCase();
	if (READ_ONLY_HTTP_METHODS.has(verb)) {
		return false;
	}
	return shouldBlockSingleTabApi(path, method, baseURL);
}

let socketConnectedForHandoff = false;

export function setBrowserTabSocketConnected(connected: boolean): void {
	socketConnectedForHandoff = connected;
}

export function isBrowserTabSocketConnected(): boolean {
	return socketConnectedForHandoff;
}
