/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-tab Keycloak session events (`session_replaced`) via BroadcastChannel
 * and `localStorage` storage events. Leaf helper for the public `keycloak.ts` facade.
 *
 * Invariants:
 * - Does not import `keycloak.ts` (bind applicator from facade to avoid cycles).
 * - Listeners skip when `profileAllowsLocalTokenStorage()` is false (APK profile).
 * - Lazy authSessionCoordinator cascade stays in the facade, not here.
 *
 * Related:
 * - `services/keycloak.ts`, `keycloakProfile.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`
 */

import { profileAllowsLocalTokenStorage } from './keycloakProfile';

export const KEYCLOAK_SESSION_EVENT_STORAGE_KEY =
	'eliteew.keycloak.sessionEvent.v1';
export const KEYCLOAK_SESSION_EVENT_CHANNEL = 'eliteew.keycloak.session.v1';

export type KeycloakSessionEvent = {
	type: 'session_replaced';
	reason?: string;
	at: number;
};

type SessionReplacedApplicator = () => void;

let sessionEventListenersReady = false;
let sessionBroadcastChannel: BroadcastChannel | null = null;
let applyLocalSessionReplaced: SessionReplacedApplicator | null = null;

/** Facade binds `() => keycloak.clearToken(true)` after constructing AuthOidcFacade. */
export function bindSessionReplacedApplicator(
	applicator: SessionReplacedApplicator
): void {
	applyLocalSessionReplaced = applicator;
}

export function applySessionReplacedEvent(): void {
	applyLocalSessionReplaced?.();
}

export function publishSessionEvent(event: KeycloakSessionEvent): void {
	if (typeof window === 'undefined') return;
	try {
		sessionBroadcastChannel?.postMessage(event);
	} catch {
		/* BroadcastChannel can be blocked in some WebViews. */
	}
	try {
		localStorage.setItem(
			KEYCLOAK_SESSION_EVENT_STORAGE_KEY,
			JSON.stringify(event)
		);
	} catch {
		/* storage may be unavailable in private mode */
	}
}

export function setupSessionEventListeners(): void {
	if (sessionEventListenersReady || typeof window === 'undefined') return;
	if (!profileAllowsLocalTokenStorage()) {
		return;
	}
	sessionEventListenersReady = true;
	if (typeof BroadcastChannel !== 'undefined') {
		try {
			sessionBroadcastChannel = new BroadcastChannel(
				KEYCLOAK_SESSION_EVENT_CHANNEL
			);
			sessionBroadcastChannel.onmessage = (event: MessageEvent) => {
				const data = event.data as KeycloakSessionEvent | undefined;
				if (data?.type === 'session_replaced') {
					applySessionReplacedEvent();
				}
			};
		} catch {
			sessionBroadcastChannel = null;
		}
	}
	window.addEventListener('storage', (event) => {
		if (event.key !== KEYCLOAK_SESSION_EVENT_STORAGE_KEY || !event.newValue) {
			return;
		}
		try {
			const parsed = JSON.parse(event.newValue) as KeycloakSessionEvent;
			if (parsed.type === 'session_replaced') {
				applySessionReplacedEvent();
			}
		} catch {
			/* ignore malformed cross-tab event */
		}
	});
}
