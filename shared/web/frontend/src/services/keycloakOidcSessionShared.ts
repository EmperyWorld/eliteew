/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types, constants, and helpers for AuthOidcFacade flow modules
 * (login / callback / refresh / logout). No barrel import — avoids cycles.
 *
 * Invariants:
 * - Leaves and flow modules must not import `keycloak.ts` or create cycles
 *   with `authSessionCoordinator` (logout cascade stays lazy).
 *
 * Related:
 * - `keycloakAuthOidcFacade.ts`, `keycloakOidcLoginFlow.ts`,
 *   `keycloakOidcCallbackFlow.ts`, `keycloakOidcRefreshFlow.ts`,
 *   `keycloakOidcLogoutFlow.ts`, `documentation/product/FRONTEND-AUTH.md`
 */

import type * as oauth from 'oauth4webapi';
import { getProfileKeycloakClientId } from './keycloakProfile';
import { getKeycloakClientId } from './keycloakOidcDiscovery';
import type { KeycloakTokenPersistence } from './keycloakTokenStorage';

export type KeycloakRoleBucket = { roles?: string[] };
export type KeycloakResourceAccess = Record<string, KeycloakRoleBucket>;

export interface KeycloakTokenParsed {
	sub?: string;
	exp?: number;
	iat?: number;
	auth_time?: number;
	email?: string;
	name?: string;
	given_name?: string;
	family_name?: string;
	preferred_username?: string;
	realm_access?: { roles?: string[] };
	resource_access?: KeycloakResourceAccess;
	[key: string]: unknown;
}

export interface KeycloakLoginOptions {
	redirectUri?: string;
	/** true — localStorage; false/undefined — sessionStorage до закрытия вкладки. */
	persistSession?: boolean;
	/** Force Keycloak to re-authenticate the user and refresh OIDC auth_time. */
	forceFreshAuth?: boolean;
}

export interface KeycloakLogoutOptions {
	redirectUri?: string;
}

export interface KeycloakUserProfile {
	id?: string;
	username?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
}

export interface SsoCallbackTokens {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	token_type?: string;
	id_token?: string | null;
}

export interface SsoCallbackResponse {
	tokens?: SsoCallbackTokens;
	user?: unknown;
}

export interface SsoCallbackErrorBody {
	error?: string;
	reason?: string;
	action?: string;
	detail?: string | SsoCallbackErrorBody;
}

export const KEYCLOAK_LOG = 'Keycloak';
export const OIDC_SCOPES = 'openid profile email';

export const oidcClient: oauth.Client = {
	get client_id() {
		return getProfileKeycloakClientId();
	},
};

export type AuthVoidCallback = () => void;

const tokenExpiredSubscribers = new Set<AuthVoidCallback>();
const authRefreshSuccessSubscribers = new Set<AuthVoidCallback>();

export function subscribeTokenExpired(callback: AuthVoidCallback): () => void {
	tokenExpiredSubscribers.add(callback);
	return () => {
		tokenExpiredSubscribers.delete(callback);
	};
}

export function subscribeAuthRefreshSuccess(
	callback: AuthVoidCallback
): () => void {
	authRefreshSuccessSubscribers.add(callback);
	return () => {
		authRefreshSuccessSubscribers.delete(callback);
	};
}

export function notifyTokenExpiredSubscribers(): void {
	for (const fn of tokenExpiredSubscribers) {
		try {
			fn();
		} catch {
			/* subscriber errors must not break auth runtime */
		}
	}
}

export function notifyAuthRefreshSuccessSubscribers(): void {
	for (const fn of authRefreshSuccessSubscribers) {
		try {
			fn();
		} catch {
			/* subscriber errors must not break auth runtime */
		}
	}
}

/** Lazy import breaks client → authSession → keycloak → coordinator cycle at module load. */
export function runPostKeycloakSessionClearCascade(
	principalId: string | null | undefined
): void {
	void import('./auth/authSessionCoordinator').then(
		({ executePostKeycloakSessionClearCascade }) => {
			executePostKeycloakSessionClearCascade({ principalId });
		}
	);
}

export function getKeycloakApiClientId(): string {
	return import.meta.env.VITE_KEYCLOAK_API_CLIENT_ID || 'empery-api';
}

export function decodeJwtPayload(
	token: string | undefined
): KeycloakTokenParsed | undefined {
	if (!token) return undefined;
	const [, rawPayload] = token.split('.');
	if (!rawPayload) return undefined;
	try {
		const normalized = rawPayload.replace(/-/g, '+').replace(/_/g, '/');
		const padLength = normalized.length % 4;
		const padded =
			padLength === 0 ? normalized : normalized + '='.repeat(4 - padLength);
		const json =
			typeof atob === 'function'
				? atob(padded)
				: Buffer.from(padded, 'base64').toString('utf-8');
		return JSON.parse(json) as KeycloakTokenParsed;
	} catch {
		return undefined;
	}
}

export function normalizeSsoCallbackErrorBody(
	value: unknown
): SsoCallbackErrorBody {
	if (!value || typeof value !== 'object') return {};
	const body = value as SsoCallbackErrorBody & {
		detail?: SsoCallbackErrorBody | string;
	};
	if (body.detail && typeof body.detail === 'object') {
		return body.detail;
	}
	return body;
}

export function clientRolesFromResourceAccess(
	resourceAccess: KeycloakResourceAccess | undefined
): string[] {
	const web = getKeycloakClientId();
	const api = getKeycloakApiClientId();
	const seen = new Set<string>();
	const out: string[] = [];
	for (const clientId of [web, api]) {
		const roles = resourceAccess?.[clientId]?.roles;
		if (!Array.isArray(roles)) continue;
		for (const role of roles) {
			const value = String(role);
			if (seen.has(value)) continue;
			seen.add(value);
			out.push(value);
		}
	}
	return out;
}

/**
 * Structural host for OIDC flow modules. Implemented by AuthOidcFacade;
 * fields that were class-private are intentionally readable here for atomization.
 */
export type AuthOidcSessionHost = {
	authenticated: boolean;
	token?: string;
	refreshToken?: string;
	idToken?: string;
	tokenParsed?: KeycloakTokenParsed;
	refreshTokenParsed?: KeycloakTokenParsed;
	idTokenParsed?: KeycloakTokenParsed;
	subject?: string;
	timeSkew?: number;
	onAuthSuccess?: () => void;
	onAuthError?: (error?: unknown) => void;
	onTokenExpired?: () => void;
	onAuthRefreshSuccess?: () => void;
	onAuthRefreshError?: () => void;
	onAuthLogout?: () => void;
	tokenExpiryTimer: ReturnType<typeof setTimeout> | null;
	authServerPromise: Promise<oauth.AuthorizationServer> | null;
	refreshInFlight: Promise<boolean> | null;
	oidcInteractiveRedirectInFlight: boolean;
	tokenPersistence: KeycloakTokenPersistence;
	applyTokens(input: {
		accessToken?: string;
		refreshToken?: string;
		idToken?: string;
		timeSkew?: number;
		expiresIn?: number;
	}): void;
	persistCurrentTokens(): void;
	clearSession(clearStorage: boolean, fireLogout?: boolean): void;
	getAuthorizationServer(): Promise<oauth.AuthorizationServer>;
	refreshAccessToken(): Promise<boolean>;
	exchangeAuthorizationCodeViaBackend(
		input: {
			code: string;
			state: string | null;
			redirectUri: string;
			codeVerifier: string;
		},
		replaceConfirmed?: boolean
	): Promise<SsoCallbackResponse>;
	invoke<T extends unknown[]>(
		fn: ((...args: T) => void) | undefined,
		...args: T
	): void;
	scheduleTokenExpiredEvent(): void;
	shouldPreserveOidcAuthorizationState(): boolean;
};
