/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared SSO session-replace confirmation gate for HTTP and Socket.IO auth paths.
 *
 * Invariants:
 * - One in-flight confirm prompt per browser profile; parallel callers await the same outcome.
 * - Mid-session API/modal confirm window is short (30s); login OAuth uses a longer TTL so
 *   Keycloak password entry survives the full-page redirect before callback.
 *
 * Related:
 * - services/api/client.ts, services/auth/authenticatedSocketAuth.ts
 * - components/AppRouter.tsx (LoginPageFallback)
 * - documentation/product/FRONTEND-AUTH.md
 */

import authSession from '../authSession';
import { showSessionReplaceCancelledToast } from './sessionAuthToasts';
import { invokeSessionReplacePromptHandler } from './ssoSessionReplaceConfirmBridge';

export const SESSION_REPLACE_CONFIRM_HEADER = 'X-SSO-Replace-Confirm';
/** Mid-session HTTP/Socket confirm after modal — short reuse window. */
export const SESSION_REPLACE_CONFIRM_WINDOW_MS = 30_000;
/**
 * Login fallback arms confirm before PKCE; must outlive Keycloak interactive login.
 */
export const SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS = 15 * 60_000;
const SESSION_REPLACE_CONFIRMED_UNTIL_KEY =
	'eliteew.auth.sessionReplaceConfirmedUntil.v1';

let sessionReplaceXorPartner: string | null = null;

/** Remember XOR partner class for FoFline↔browser confirm copy (W3). */
export function setSessionReplaceXorPartner(partner: string | null): void {
	sessionReplaceXorPartner = (partner || '').trim().toLowerCase() || null;
}

export function peekSessionReplaceXorPartner(): string | null {
	return sessionReplaceXorPartner;
}

export function clearSessionReplaceXorPartner(): void {
	sessionReplaceXorPartner = null;
}

let sessionReplaceConfirmationPrompt: Promise<boolean> | null = null;
let sessionReplaceResolutionInFlight: Promise<boolean> | null = null;
let sessionReplaceConfirmedUntil = 0;

export function hasActiveSessionReplaceConfirmation(): boolean {
	const now = Date.now();
	if (sessionReplaceConfirmedUntil > now) {
		return true;
	}
	if (typeof sessionStorage === 'undefined') {
		return false;
	}
	try {
		const storedUntil = Number(
			sessionStorage.getItem(SESSION_REPLACE_CONFIRMED_UNTIL_KEY)
		);
		if (Number.isFinite(storedUntil) && storedUntil > now) {
			sessionReplaceConfirmedUntil = storedUntil;
			return true;
		}
		sessionStorage.removeItem(SESSION_REPLACE_CONFIRMED_UNTIL_KEY);
	} catch {
		/* ignore unavailable storage */
	}
	return false;
}

/**
 * Arm `X-SSO-Replace-Confirm` for the next SSO callback / API retry.
 * @param ttlMs - Override TTL; default mid-session 30s. Login OAuth uses
 *   {@link SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS}.
 */
export function markSessionReplaceConfirmedWindow(
	ttlMs: number = SESSION_REPLACE_CONFIRM_WINDOW_MS
): void {
	const safeTtl =
		Number.isFinite(ttlMs) && ttlMs > 0
			? ttlMs
			: SESSION_REPLACE_CONFIRM_WINDOW_MS;
	const until = Date.now() + safeTtl;
	sessionReplaceConfirmedUntil = until;
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(SESSION_REPLACE_CONFIRMED_UNTIL_KEY, String(until));
	} catch {
		/* ignore unavailable storage */
	}
}

export function clearSessionReplaceConfirmedWindow(): void {
	sessionReplaceConfirmedUntil = 0;
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(SESSION_REPLACE_CONFIRMED_UNTIL_KEY);
	} catch {
		/* ignore unavailable storage */
	}
}

/** Test-only reset for module-level SSO replace coordinator state. */
export function resetSessionReplaceConfirmationStateForTests(): void {
	sessionReplaceConfirmationPrompt = null;
	sessionReplaceResolutionInFlight = null;
	clearSessionReplaceXorPartner();
	clearSessionReplaceConfirmedWindow();
}

function requestSessionReplaceConfirmation(): Promise<boolean> {
	if (typeof window === 'undefined') {
		return Promise.resolve(false);
	}
	if (sessionReplaceConfirmationPrompt) {
		return sessionReplaceConfirmationPrompt;
	}
	sessionReplaceConfirmationPrompt =
		invokeSessionReplacePromptHandler().finally(() => {
			sessionReplaceConfirmationPrompt = null;
		});
	return sessionReplaceConfirmationPrompt;
}

export function handleSessionReplaceConfirmationRejected(): void {
	clearSessionReplaceConfirmedWindow();
	try {
		authSession.clearToken(true);
	} catch {
		// ignore local cleanup errors
	}
	showSessionReplaceCancelledToast();
}

export async function resolveSessionReplaceConfirmation(): Promise<boolean> {
	if (hasActiveSessionReplaceConfirmation()) {
		return true;
	}
	if (sessionReplaceResolutionInFlight) {
		return sessionReplaceResolutionInFlight;
	}
	sessionReplaceResolutionInFlight = (async () => {
		const confirmed = await requestSessionReplaceConfirmation();
		if (confirmed) {
			markSessionReplaceConfirmedWindow();
		} else {
			handleSessionReplaceConfirmationRejected();
		}
		return confirmed;
	})().finally(() => {
		sessionReplaceResolutionInFlight = null;
	});
	return sessionReplaceResolutionInFlight;
}

/** Socket.IO auth flag after operator confirmed replace in this profile. */
export function getSocketSsoReplaceConfirmFlag(): 1 | undefined {
	return hasActiveSessionReplaceConfirmation() ? 1 : undefined;
}

export async function confirmSessionReplaceForSocket(): Promise<boolean> {
	return resolveSessionReplaceConfirmation();
}
