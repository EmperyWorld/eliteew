/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Единая точка интерактивного web-login для SPA: сохраняет intended page и запускает PKCE-redirect
 * через `authSession.login`. Держит синхронный guard, чтобы App, axios и sockets не стартовали
 * несколько discovery/redirect параллельно.
 *
 * Invariants:
 * - `redirect_uri` всегда нормализуется без hash, иначе OAuth callback ломается.
 * - Guard выставляется до любых async-шагов; повторные вызовы в том же цикле не запускают новый login.
 *
 * Related:
 * - `services/keycloak.ts`, `App.tsx`, `services/api/client.ts`, `documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md`
 */

import authSession, {
	isAuthSessionAuthenticated,
} from '../services/authSession';
import {
	hasPendingAuthorizationCallbackInUrl,
	resetOidcInteractiveRedirectInFlight,
} from '../services/keycloak';
import { INTENDED_PAGE_SESSION_KEY } from '../constants/storageKeys';
import { isEmbeddedEliteEWClient } from './eliteewEmbeddedClient';
import { getShellPageIdForIntendedStorage } from './pageRouting';
import {
	normalizeRedirectUri,
	resolveDefaultOidcRedirectUri,
} from './redirectUriNormalize';

export {
	normalizeRedirectUri,
	resolveDefaultOidcRedirectUri,
} from './redirectUriNormalize';

export type InteractiveLoginReason =
	| 'app_gate'
	| 'api_precheck'
	| 'api_401'
	| 'api_403'
	| 'socket_auth'
	| 'manual_login'
	| 'return_url'
	| 'mobile_app_download';

const BACKGROUND_INTERACTIVE_LOGIN_REASONS = new Set<InteractiveLoginReason>([
	'app_gate',
	'api_precheck',
	'api_401',
	'api_403',
	'socket_auth',
]);

export const AUTH_CALLBACK_FAILED_SESSION_KEY =
	'eliteew.auth.oidcCallbackFailed.v1' as const;
export const AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY =
	'eliteew.login.autoAttempted.v1' as const;
/** Set during explicit user logout — blocks LoginPageFallback auto-login until manual sign-in. */
export const AUTH_EXPLICIT_LOGOUT_PENDING_SESSION_KEY =
	'eliteew.auth.explicitLogoutPending.v1' as const;

let interactiveLoginInFlight = false;

export function isInteractiveLoginInFlight(): boolean {
	return interactiveLoginInFlight;
}

export function resetInteractiveLoginGuard(): void {
	interactiveLoginInFlight = false;
}

export function __resetInteractiveLoginForTests(): void {
	resetInteractiveLoginGuard();
}

export function markAuthCallbackFailed(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(
			AUTH_CALLBACK_FAILED_SESSION_KEY,
			String(Date.now())
		);
	} catch {
		/* ignore */
	}
}

export function clearAuthCallbackFailed(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_CALLBACK_FAILED_SESSION_KEY);
	} catch {
		/* ignore */
	}
}

export function clearAuthAutoLoginAttempted(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY);
	} catch {
		/* ignore */
	}
}

export function markExplicitLogoutPending(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_EXPLICIT_LOGOUT_PENDING_SESSION_KEY, '1');
	} catch {
		/* ignore */
	}
}

export function clearExplicitLogoutPending(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_EXPLICIT_LOGOUT_PENDING_SESSION_KEY);
	} catch {
		/* ignore */
	}
}

export function hasExplicitLogoutPending(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return (
			sessionStorage.getItem(AUTH_EXPLICIT_LOGOUT_PENDING_SESSION_KEY) != null
		);
	} catch {
		return false;
	}
}

export function hasAuthCallbackFailed(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return sessionStorage.getItem(AUTH_CALLBACK_FAILED_SESSION_KEY) != null;
	} catch {
		return false;
	}
}

export const AUTH_SESSION_REPLACED_PENDING_KEY =
	'eliteew.auth.sessionReplacedPending.v1' as const;

export function markSessionReplacedPending(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_SESSION_REPLACED_PENDING_KEY, '1');
		clearAuthAutoLoginAttempted();
	} catch {
		/* ignore */
	}
}

export function clearSessionReplacedPending(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_SESSION_REPLACED_PENDING_KEY);
	} catch {
		/* ignore */
	}
}

export function hasSessionReplacedPending(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return sessionStorage.getItem(AUTH_SESSION_REPLACED_PENDING_KEY) != null;
	} catch {
		return false;
	}
}

/** Continuity W3: terminal idle/max/reuse — blocks auto-PKCE (≠ session_replaced). */
export const AUTH_SESSION_ENDED_PENDING_KEY =
	'eliteew.auth.sessionEndedPending.v1' as const;
export const AUTH_SESSION_ENDED_META_KEY =
	'eliteew.auth.sessionEndedMeta.v1' as const;

export type SessionEndedMeta = {
	kind: string;
	preserved: boolean;
	preservedAt: string;
};

export function markSessionEndedPending(meta: SessionEndedMeta): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_SESSION_ENDED_PENDING_KEY, '1');
		sessionStorage.setItem(AUTH_SESSION_ENDED_META_KEY, JSON.stringify(meta));
		clearAuthAutoLoginAttempted();
	} catch {
		/* ignore */
	}
}

export function clearSessionEndedPending(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_SESSION_ENDED_PENDING_KEY);
		sessionStorage.removeItem(AUTH_SESSION_ENDED_META_KEY);
	} catch {
		/* ignore */
	}
}

export function hasSessionEndedPending(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return sessionStorage.getItem(AUTH_SESSION_ENDED_PENDING_KEY) != null;
	} catch {
		return false;
	}
}

export function readSessionEndedMeta(): SessionEndedMeta | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(AUTH_SESSION_ENDED_META_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SessionEndedMeta;
		if (!parsed || typeof parsed.kind !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

function markInteractiveLoginInFlight(): void {
	interactiveLoginInFlight = true;
}

function saveCurrentPageForReturn(): void {
	const currentPage = getShellPageIdForIntendedStorage() ?? 'desktop';
	try {
		sessionStorage.setItem(INTENDED_PAGE_SESSION_KEY, currentPage);
	} catch {
		// Session storage can be unavailable in private/locked-down browsers.
	}
}

export function beginInteractiveLogin(
	_reason: InteractiveLoginReason,
	options?: {
		redirectUri?: string;
		saveReturnPage?: boolean;
		/** false — сессия только до закрытия вкладки (sessionStorage). */
		persistSession?: boolean;
		/** Keycloak prompt=login — после session_replaced или явного re-auth. */
		forceFreshAuth?: boolean;
	}
): void {
	if (typeof window === 'undefined') return;
	if (_reason === 'manual_login') {
		resetInteractiveLoginGuard();
		resetOidcInteractiveRedirectInFlight();
	} else if (
		BACKGROUND_INTERACTIVE_LOGIN_REASONS.has(_reason) &&
		(!isAuthSessionAuthenticated() ||
			hasSessionReplacedPending() ||
			hasSessionEndedPending())
	) {
		return;
	}
	if (interactiveLoginInFlight) return;
	if (hasPendingAuthorizationCallbackInUrl()) return;
	// Mobile EWA WebView uses native empery-mobile tokens — browser OIDC redirect breaks Keycloak redirect_uri.
	if (isEmbeddedEliteEWClient()) return;

	markInteractiveLoginInFlight();

	const redirectUri = normalizeRedirectUri(
		options?.redirectUri ?? resolveDefaultOidcRedirectUri()
	);

	const isAuthRoute =
		window.location.pathname.includes('/login') ||
		window.location.pathname.includes('/auth');
	if (options?.saveReturnPage !== false && !isAuthRoute) {
		saveCurrentPageForReturn();
	}

	void authSession.login({
		redirectUri,
		persistSession: options?.persistSession,
		forceFreshAuth: options?.forceFreshAuth,
	});
}

/**
 * Сохранить текущую страницу в `INTENDED_PAGE_SESSION_KEY` и перенаправить на логин.
 * Единая точка для 401/403 и WebSocket auth failure.
 */
export function redirectToLoginWithReturnUrl(): void {
	beginInteractiveLogin('return_url');
}
