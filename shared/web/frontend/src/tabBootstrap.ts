/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zero-dependency tab election before React/full App load (follower skips heavy SPA tree).
 *
 * Invariants:
 * - Must not import Desktop modules or App router (keeps follower entry bundle small).
 * - OAuth callbacks always enter the full application before tab election.
 *
 * Related:
 * - `main.tsx`, `followerMain.tsx`, `pages/Desktop/utils/desktopRealtimeLeader.ts`
 */

import { isEmbeddedEliteEWClient } from './utils/eliteewEmbeddedClient';
import {
	readWindowBootLocation,
	resolveBootEntryPolicy,
} from './services/boot/bootRoutePolicy';

const LOCK_PREFIX = 'eliteew-desktop-realtime:';
const LEADER_STALE_MS = 3500;
const KEYCLOAK_TOKEN_KEY = 'eliteew.keycloak.oidcTokens.v1';
const SESSION_TAB_ID_KEY = 'eliteew.browser-tab-session-id';

export type TabBootstrapRole = 'leader' | 'follower' | 'skip';

function getOrCreateTabSessionId(): string {
	if (typeof sessionStorage === 'undefined') {
		return `tab-${Date.now()}`;
	}
	try {
		const existing = sessionStorage.getItem(SESSION_TAB_ID_KEY);
		if (existing?.trim()) {
			return existing.trim();
		}
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		sessionStorage.setItem(SESSION_TAB_ID_KEY, id);
		return id;
	} catch {
		return `tab-${Date.now()}`;
	}
}

function decodeJwtSub(accessToken: string | undefined): string | null {
	if (!accessToken) {
		return null;
	}
	try {
		const part = accessToken.split('.')[1];
		if (!part) {
			return null;
		}
		const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
		const sub = typeof json.sub === 'string' ? json.sub.trim() : '';
		return sub || null;
	} catch {
		return null;
	}
}

/** User id from persisted OIDC tokens (before AuthContext). */
export function readBootstrapUserId(): string | null {
	if (typeof localStorage === 'undefined') {
		return null;
	}
	try {
		const raw = localStorage.getItem(KEYCLOAK_TOKEN_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as {
			accessToken?: string;
			token?: string;
		};
		return decodeJwtSub(parsed.accessToken ?? parsed.token);
	} catch {
		return null;
	}
}

export function detectBootstrapTabRole(userId: string): 'leader' | 'follower' {
	const tabId = getOrCreateTabSessionId();
	const storageKey = `${LOCK_PREFIX}heartbeat:${userId.trim()}`;
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) {
			return 'leader';
		}
		const parsed = JSON.parse(raw) as { tabId?: string; ts?: number };
		const leaderTabId = parsed.tabId ?? null;
		const leaderTs = typeof parsed.ts === 'number' ? parsed.ts : 0;
		const stale = Date.now() - leaderTs > LEADER_STALE_MS;
		if (leaderTabId === tabId || !leaderTabId || stale) {
			return 'leader';
		}
		return 'follower';
	} catch {
		return 'leader';
	}
}

/**
 * Follower on desktop/admin hash → load minimal entry (`followerMain`) instead of full App.
 */
export function resolveTabBootstrapRole(): TabBootstrapRole {
	if (isEmbeddedEliteEWClient()) {
		return 'skip';
	}
	const policy = resolveBootEntryPolicy(readWindowBootLocation());
	if (!policy.singleTabEligible) {
		return 'skip';
	}
	const userId = readBootstrapUserId();
	if (!userId) {
		return 'skip';
	}
	return detectBootstrapTabRole(userId);
}

export function markBootstrapFollowerDocument(): void {
	if (typeof document !== 'undefined') {
		document.documentElement.dataset.eliteewTabRole = 'follower';
	}
}
