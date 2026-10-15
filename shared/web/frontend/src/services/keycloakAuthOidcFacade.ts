/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AuthOidcFacade orchestrator: bootstrap/init, session core (apply/clear/persist),
 * and public wrappers. Login/callback/refresh/logout live in flow modules.
 *
 * Invariants:
 * - Public export names via `keycloak.ts` barrel stay stable.
 * - No cycle with authSessionCoordinator (lazy import for logout cascade).
 * - Flow modules receive this host; they must not import this barrel.
 *
 * Related:
 * - `keycloakOidcLoginFlow.ts`, `keycloakOidcCallbackFlow.ts`,
 *   `keycloakOidcRefreshFlow.ts`, `keycloakOidcLogoutFlow.ts`,
 *   `keycloakOidcSessionShared.ts`, `keycloak.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`
 */

import * as oauth from 'oauth4webapi';
import { resolveDefaultOidcRedirectUri } from '../utils/redirectUriNormalize';
import { log } from '../utils/logger';
import { isEmbeddedEliteEWClient } from '../utils/eliteewEmbeddedClient';
import {
	fetchAuthorizationServerDiscovery,
	getIssuerUrl,
} from './keycloakOidcDiscovery';
import {
	clearAuthorizationResponseFromUrl,
	clearOidcAuthorizationState,
	hasPendingAuthorizationCallbackInUrl,
	readAuthorizationResponseParams,
	readOidcAuthorizationState,
	writeOidcAuthorizationState,
} from './keycloakPkceState';
import {
	applySessionReplacedEvent,
	bindSessionReplacedApplicator,
	publishSessionEvent,
	setupSessionEventListeners,
} from './keycloakSessionEvents';
import {
	KEYCLOAK_PERSISTENCE_PREF_KEY,
	KEYCLOAK_TOKEN_STORAGE_KEY,
	type KeycloakTokenPersistence,
	clearPersistedKeycloakTokens,
	persistKeycloakTokens,
	readPersistedKeycloakTokens,
	resolveTokenPersistence,
} from './keycloakTokenStorage';
import {
	accessTokenStillValid,
	hydrateMobileEmbeddedTokensFromNativeBridge as hydrateEmbeddedTokensFromNativeBridge,
	isMobileEmbeddedOidcContext,
} from './keycloakEmbeddedOidc';
import {
	hasDesktopNativeOidcBridge,
	hydrateDesktopNativeTokensFromNativeBridge,
} from './keycloakDesktopNativeOidc';
import {
	oidcExchangeAuthorizationCodeViaBackend,
	oidcHandleAuthorizationCallback,
} from './keycloakOidcCallbackFlow';
import { oidcLogin, oidcRegister } from './keycloakOidcLoginFlow';
import { oidcLogout } from './keycloakOidcLogoutFlow';
import { shouldEagerRefreshStoredSession } from './keycloakOidcRefreshCrossTab';
import {
	oidcRecoverEmbeddedSession,
	oidcRefreshAccessToken,
	oidcUpdateToken,
} from './keycloakOidcRefreshFlow';
import {
	KEYCLOAK_LOG,
	clientRolesFromResourceAccess,
	decodeJwtPayload,
	notifyTokenExpiredSubscribers,
	runPostKeycloakSessionClearCascade,
	subscribeAuthRefreshSuccess,
	subscribeTokenExpired,
	type KeycloakLoginOptions,
	type KeycloakLogoutOptions,
	type KeycloakTokenParsed,
	type KeycloakUserProfile,
	type SsoCallbackResponse,
} from './keycloakOidcSessionShared';

export type {
	KeycloakTokenParsed,
	KeycloakLoginOptions,
	KeycloakLogoutOptions,
	KeycloakUserProfile,
	SsoCallbackResponse,
} from './keycloakOidcSessionShared';

export { subscribeTokenExpired, subscribeAuthRefreshSuccess };

class AuthOidcFacade {
	public authenticated = false;
	public token?: string;
	public refreshToken?: string;
	public idToken?: string;
	public tokenParsed?: KeycloakTokenParsed;
	public refreshTokenParsed?: KeycloakTokenParsed;
	public idTokenParsed?: KeycloakTokenParsed;
	public subject?: string;
	public timeSkew?: number;

	public onAuthSuccess?: () => void;
	public onAuthError?: (error?: unknown) => void;
	public onTokenExpired?: () => void;
	public onAuthRefreshSuccess?: () => void;
	public onAuthRefreshError?: () => void;
	public onAuthLogout?: () => void;

	/** Host fields for flow modules (formerly private). */
	tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;
	authServerPromise: Promise<oauth.AuthorizationServer> | null = null;
	refreshInFlight: Promise<boolean> | null = null;
	oidcInteractiveRedirectInFlight = false;
	tokenPersistence: KeycloakTokenPersistence = 'local';

	public hydrateMobileEmbeddedTokensFromNativeBridge(): void {
		hydrateEmbeddedTokensFromNativeBridge();
	}

	public hydrateDesktopNativeTokensFromNativeBridge(): void {
		hydrateDesktopNativeTokensFromNativeBridge();
	}

	public async init(): Promise<boolean> {
		this.hydrateMobileEmbeddedTokensFromNativeBridge();
		this.hydrateDesktopNativeTokensFromNativeBridge();
		const callbackParams = readAuthorizationResponseParams();
		if (callbackParams) {
			try {
				const authenticated = await oidcHandleAuthorizationCallback(
					this,
					callbackParams
				);
				return authenticated;
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				log.error(KEYCLOAK_LOG, 'Authorization callback failed', err);
				clearAuthorizationResponseFromUrl();
				const {
					markAuthCallbackFailed,
					markSessionReplacedPending,
					resetInteractiveLoginGuard,
				} = await import('../utils/authRedirect');
				markAuthCallbackFailed();
				resetInteractiveLoginGuard();
				if (/Missing OIDC authorization state/i.test(err.message)) {
					log.warn(
						KEYCLOAK_LOG,
						'OIDC PKCE state missing — stop auto-redirect loop; user must sign in from login screen'
					);
					this.invoke(this.onAuthError, err);
					return false;
				}
				if (
					/session_replaced|Session was replaced by a newer login/i.test(
						err.message
					)
				) {
					log.warn(
						KEYCLOAK_LOG,
						'Stale OAuth callback (registry has newer sid) — stop auto-redirect; user must sign in with fresh Keycloak session'
					);
					markSessionReplacedPending();
					const principalId = this.subject ?? this.tokenParsed?.sub ?? null;
					this.clearSession(true);
					runPostKeycloakSessionClearCascade(principalId);
					this.invoke(this.onAuthError, err);
					return false;
				}
				const principalId = this.subject ?? this.tokenParsed?.sub ?? null;
				this.clearSession(true);
				runPostKeycloakSessionClearCascade(principalId);
				this.invoke(this.onAuthError, err);
				return false;
			}
		}

		const storedTokens = readPersistedKeycloakTokens({
			allowAccessOnly: hasDesktopNativeOidcBridge(),
		});
		if (!storedTokens?.token) {
			return false;
		}
		if (!storedTokens.refreshToken && !hasDesktopNativeOidcBridge()) {
			return false;
		}

		this.tokenPersistence = storedTokens.persistence ?? 'local';

		this.applyTokens({
			accessToken: storedTokens.token,
			refreshToken: storedTokens.refreshToken,
			idToken: storedTokens.idToken,
			timeSkew: storedTokens.timeSkew,
		});

		// Browser + embedded: never rotate refresh on cold init while AT is still
		// fresh. Eager rotation under refreshTokenMaxReuse=0 races other tabs /
		// remounts and surfaces Continuity "session ended" seconds after login.
		if (!shouldEagerRefreshStoredSession(this.tokenParsed)) {
			log.info(
				KEYCLOAK_LOG,
				'Bootstrap: valid access token — skip eager Keycloak refresh'
			);
			this.invoke(this.onAuthSuccess);
			return true;
		}

		try {
			await this.refreshAccessToken();
			this.invoke(this.onAuthSuccess);
			return true;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			if (
				isMobileEmbeddedOidcContext() &&
				accessTokenStillValid(this.tokenParsed)
			) {
				log.warn(
					KEYCLOAK_LOG,
					`Mobile embedded refresh failed (${err.message}); using bootstrap access token`
				);
				this.invoke(this.onAuthSuccess);
				return true;
			}
			if (
				isMobileEmbeddedOidcContext() &&
				storedTokens.token &&
				storedTokens.refreshToken
			) {
				log.warn(
					KEYCLOAK_LOG,
					`Mobile embedded refresh failed (${err.message}); trusting native bootstrap tokens`
				);
				this.invoke(this.onAuthSuccess);
				return true;
			}
			log.warn(
				KEYCLOAK_LOG,
				`Stored OIDC session is no longer valid: ${err.message}`
			);
			const principalId = this.subject ?? this.tokenParsed?.sub ?? null;
			this.clearSession(true);
			runPostKeycloakSessionClearCascade(principalId);
			return false;
		}
	}

	public async login(options?: KeycloakLoginOptions): Promise<void> {
		return oidcLogin(this, options);
	}

	public async register(options?: KeycloakLoginOptions): Promise<void> {
		return oidcRegister(this, options);
	}

	public async logout(options?: KeycloakLogoutOptions): Promise<void> {
		return oidcLogout(this, options);
	}

	public async updateToken(minValidity = 30): Promise<boolean> {
		return oidcUpdateToken(this, minValidity);
	}

	public async recoverEmbeddedSession(): Promise<boolean> {
		return oidcRecoverEmbeddedSession(this);
	}

	public async loadUserProfile(): Promise<KeycloakUserProfile> {
		const token = this.tokenParsed;
		if (!token) {
			throw new Error('No authenticated user profile');
		}
		return {
			id: token.sub,
			username: token.preferred_username,
			email: token.email,
			firstName: token.given_name,
			lastName: token.family_name,
		};
	}

	public clearToken(fireLogout = false): void {
		this.clearSession(true, fireLogout);
	}

	async exchangeAuthorizationCodeViaBackend(
		input: {
			code: string;
			state: string | null;
			redirectUri: string;
			codeVerifier: string;
		},
		replaceConfirmed = false
	): Promise<SsoCallbackResponse> {
		return oidcExchangeAuthorizationCodeViaBackend(
			this,
			input,
			replaceConfirmed
		);
	}

	async refreshAccessToken(): Promise<boolean> {
		return oidcRefreshAccessToken(this);
	}

	async getAuthorizationServer(): Promise<oauth.AuthorizationServer> {
		if (this.authServerPromise) {
			return this.authServerPromise;
		}
		this.authServerPromise = (async () => {
			const issuer = getIssuerUrl();
			const normalized = await fetchAuthorizationServerDiscovery(issuer);
			return oauth.processDiscoveryResponse(issuer, normalized);
		})();

		try {
			return await this.authServerPromise;
		} catch (error) {
			this.authServerPromise = null;
			throw error;
		}
	}

	applyTokens(input: {
		accessToken?: string;
		refreshToken?: string;
		idToken?: string;
		timeSkew?: number;
		expiresIn?: number;
	}): void {
		this.token = input.accessToken;
		this.refreshToken = input.refreshToken;
		this.idToken = input.idToken;

		this.tokenParsed = decodeJwtPayload(input.accessToken);
		this.refreshTokenParsed = decodeJwtPayload(input.refreshToken);
		this.idTokenParsed = decodeJwtPayload(input.idToken);
		this.subject = this.tokenParsed?.sub;
		this.authenticated = Boolean(
			this.token && (this.refreshToken || hasDesktopNativeOidcBridge())
		);

		if (typeof input.timeSkew === 'number') {
			this.timeSkew = input.timeSkew;
		} else if (this.tokenParsed?.exp && typeof input.expiresIn === 'number') {
			const now = Math.floor(Date.now() / 1000);
			this.timeSkew = this.tokenParsed.exp - now - input.expiresIn;
		}

		this.scheduleTokenExpiredEvent();
	}

	persistCurrentTokens(): void {
		if (!this.token) return;
		const nativeBridge = hasDesktopNativeOidcBridge();
		if (!this.refreshToken && !nativeBridge) return;
		persistKeycloakTokens(
			{
				token: this.token,
				refreshToken: nativeBridge ? undefined : this.refreshToken,
				idToken: this.idToken,
				timeSkew: this.timeSkew,
				savedAt: Date.now(),
			},
			this.tokenPersistence
		);
	}

	shouldPreserveOidcAuthorizationState(): boolean {
		return (
			this.oidcInteractiveRedirectInFlight ||
			hasPendingAuthorizationCallbackInUrl()
		);
	}

	clearSession(clearStorage: boolean, fireLogout = false): void {
		this.authenticated = false;
		this.token = undefined;
		this.refreshToken = undefined;
		this.idToken = undefined;
		this.tokenParsed = undefined;
		this.refreshTokenParsed = undefined;
		this.idTokenParsed = undefined;
		this.subject = undefined;
		this.timeSkew = undefined;
		if (this.tokenExpiryTimer) {
			clearTimeout(this.tokenExpiryTimer);
			this.tokenExpiryTimer = null;
		}
		if (clearStorage) {
			clearPersistedKeycloakTokens();
			if (!this.shouldPreserveOidcAuthorizationState()) {
				clearOidcAuthorizationState();
			}
		}
		if (fireLogout) {
			this.invoke(this.onAuthLogout);
		}
	}

	/** Clears stuck interactive redirect guard so manual SSO retry can start. */
	clearOidcInteractiveRedirectInFlight(): void {
		this.oidcInteractiveRedirectInFlight = false;
	}

	/** @internal Vitest — set interactive redirect guard without starting PKCE. */
	setOidcInteractiveRedirectInFlightForTests(inFlight: boolean): void {
		this.oidcInteractiveRedirectInFlight = inFlight;
	}

	/** @internal Vitest — expose private code exchange for contract tests. */
	exchangeAuthorizationCodeViaBackendForTests(
		input: {
			code: string;
			state: string | null;
			redirectUri: string;
			codeVerifier: string;
		},
		replaceConfirmed?: boolean
	): Promise<SsoCallbackResponse> {
		return this.exchangeAuthorizationCodeViaBackend(input, replaceConfirmed);
	}

	scheduleTokenExpiredEvent(): void {
		if (this.tokenExpiryTimer) {
			clearTimeout(this.tokenExpiryTimer);
			this.tokenExpiryTimer = null;
		}
		const exp = this.tokenParsed?.exp;
		if (!exp) return;
		const nowMs = Date.now();
		const expiresAtMs = exp * 1000;
		const delay = Math.max(0, expiresAtMs - nowMs);
		this.tokenExpiryTimer = setTimeout(() => {
			this.invoke(this.onTokenExpired);
			notifyTokenExpiredSubscribers();
		}, delay);
	}

	invoke<T extends unknown[]>(
		fn: ((...args: T) => void) | undefined,
		...args: T
	): void {
		if (!fn) return;
		try {
			fn(...args);
		} catch {
			/* hook callback errors must not break auth runtime */
		}
	}
}

/** Vitest-only: web profile storage keys. */
export const __keycloakTokenStorageForTests = {
	KEYCLOAK_TOKEN_STORAGE_KEY,
	KEYCLOAK_AUTH_STATE_STORAGE_KEY: 'eliteew.keycloak.oidcAuthState.v1',
	KEYCLOAK_PERSISTENCE_PREF_KEY,
	readPersistedKeycloakTokens,
	persistKeycloakTokens,
	clearPersistedKeycloakTokens,
	resolveTokenPersistence,
	readOidcAuthorizationState,
	writeOidcAuthorizationState,
	clearOidcAuthorizationState,
	exchangeAuthorizationCodeViaBackendForTests: (
		input: {
			code: string;
			state: string | null;
			redirectUri: string;
			codeVerifier: string;
		},
		replaceConfirmed?: boolean
	) =>
		keycloak.exchangeAuthorizationCodeViaBackendForTests(
			input,
			replaceConfirmed
		),
	setOidcInteractiveRedirectInFlightForTests: (inFlight: boolean) => {
		keycloak.setOidcInteractiveRedirectInFlightForTests(inFlight);
	},
} as const;

export const keycloak = new AuthOidcFacade();
bindSessionReplacedApplicator(() => keycloak.clearToken(true));
setupSessionEventListeners();

/** Clears stuck redirect guard so manual SSO retry can start a fresh PKCE flow. */
export function resetOidcInteractiveRedirectInFlight(): void {
	keycloak.clearOidcInteractiveRedirectInFlight();
}

export function notifySessionReplaced(reason = 'session_replaced'): void {
	applySessionReplacedEvent();
	publishSessionEvent({
		type: 'session_replaced',
		reason,
		at: Date.now(),
	});
}

export async function recoverMobileEmbeddedSession(): Promise<boolean> {
	return keycloak.recoverEmbeddedSession();
}

export async function initKeycloak(): Promise<boolean> {
	try {
		log.info(KEYCLOAK_LOG, '🔐 Initializing OIDC facade (oauth4webapi)...');
		const authenticated = await keycloak.init();
		if (authenticated) {
			log.info(KEYCLOAK_LOG, 'Authentication successful');
			log.info(
				KEYCLOAK_LOG,
				`👤 User: ${keycloak.tokenParsed?.preferred_username}`
			);
		}
		setupTokenRefresh();
		return authenticated;
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.error(KEYCLOAK_LOG, 'Initialization failed', err);
		throw err;
	}
}

function setupTokenRefresh(): void {
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	const checkAndRefresh = () => {
		const tokenExp = keycloak.tokenParsed?.exp;
		if (!tokenExp || !keycloak.authenticated) {
			refreshTimer = setTimeout(checkAndRefresh, 60000);
			return;
		}

		const now = Math.floor(Date.now() / 1000);
		const timeUntilExpiry = tokenExp - now;
		if (timeUntilExpiry < 70) {
			keycloak
				.updateToken(70)
				.then(async (refreshed) => {
					if (refreshed) {
						log.info(KEYCLOAK_LOG, '🔄 Token refreshed successfully');
						const { clearTokenCache } = await import('../utils/tokenCache');
						clearTokenCache();
					}
					refreshTimer = setTimeout(checkAndRefresh, 60000);
				})
				.catch((error) => {
					const err = error instanceof Error ? error : new Error(String(error));
					log.error(KEYCLOAK_LOG, 'Token refresh failed', err);
					if (isEmbeddedEliteEWClient()) {
						log.warn(
							KEYCLOAK_LOG,
							'Embedded client refresh timer failed — retry without clearing session'
						);
						refreshTimer = setTimeout(checkAndRefresh, 30000);
						return;
					}
					// Continuity W3: classify → recovery capsule → session-ended
					// (not session_replaced). Network failures keep the session.
					void import('./auth/webSsoTerminalTeardown').then(
						({ handleBrowserTerminalRefreshFailure }) => {
							void handleBrowserTerminalRefreshFailure({
								error,
								clearSession: () => {
									keycloak.clearSession(true, true);
								},
							}).then((result) => {
								if (result.action === 'kept') {
									refreshTimer = setTimeout(checkAndRefresh, 30000);
								}
							});
						}
					);
				});
		} else {
			const checkInterval = Math.max(
				60000,
				((timeUntilExpiry - 70) * 1000) / 2
			);
			refreshTimer = setTimeout(
				checkAndRefresh,
				Math.min(checkInterval, 300000)
			);
		}
	};

	refreshTimer = setTimeout(checkAndRefresh, 30000);
	if (typeof window !== 'undefined') {
		window.addEventListener('beforeunload', () => {
			if (refreshTimer) {
				clearTimeout(refreshTimer);
			}
		});
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible' || !keycloak.authenticated) {
				return;
			}
			void keycloak.updateToken(70).catch(() => {
				/* HTTP/socket layers retry on 401; avoid logout storm on transient failures */
			});
		});
	}
}

export async function ensureAccessTokenMinValidity(
	minValiditySec: number
): Promise<void> {
	if (!keycloak.authenticated) return;
	try {
		const refreshed = await keycloak.updateToken(minValiditySec);
		if (refreshed) {
			const { clearTokenCache } = await import('../utils/tokenCache');
			clearTokenCache();
		}
	} catch {
		/* caller handles 401 retry if refresh failed */
	}
}

export function getToken(): string | undefined {
	return keycloak.token;
}

/** Matches backend `FRESH_AUTH_MAX_AGE_SECONDS` for trusted-device pairing. */
export const FRESH_DEVICE_BINDING_AUTH_MAX_AGE_SECONDS = 10 * 60;

export function getOidcAuthTimeEpoch(): number | null {
	const raw = keycloak.tokenParsed?.auth_time as number | string | undefined;
	if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
		return Math.floor(raw);
	}
	if (typeof raw === 'string' && raw.trim()) {
		const parsed = Number.parseInt(raw, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}
	return null;
}

export function getOidcAuthAgeSeconds(): number | null {
	const authTime = getOidcAuthTimeEpoch();
	if (authTime == null) return null;
	return Math.max(0, Math.floor(Date.now() / 1000) - authTime);
}

export function isOidcAuthFreshForDeviceBinding(
	maxAgeSeconds = FRESH_DEVICE_BINDING_AUTH_MAX_AGE_SECONDS
): boolean {
	const authTime = getOidcAuthTimeEpoch();
	if (authTime == null) return false;
	const age = getOidcAuthAgeSeconds();
	return age != null && age <= maxAgeSeconds;
}

export function getUserInfo(): {
	id: string;
	email?: string;
	username?: string;
	name?: string;
	roles: string[];
	firstName?: string;
	lastName?: string;
} | null {
	const token = keycloak.tokenParsed;
	if (!token) return null;

	const realmRoles = token.realm_access?.roles || [];
	const clientRoles = clientRolesFromResourceAccess(token.resource_access);
	const roles = Array.from(new Set([...realmRoles, ...clientRoles]));

	return {
		id: token.sub || token.preferred_username || '',
		email: token.email,
		username: token.preferred_username || token.email,
		name: token.name,
		roles,
		firstName: token.given_name,
		lastName: token.family_name,
	};
}

export async function logout(): Promise<void> {
	try {
		log.info(KEYCLOAK_LOG, '🚪 Logging out...');
		await keycloak.logout({
			redirectUri: resolveDefaultOidcRedirectUri(),
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.error(KEYCLOAK_LOG, 'Logout failed', err);
	}
}

export function isAuthenticated(): boolean {
	return keycloak.authenticated;
}

export async function updateProfile(): Promise<void> {
	try {
		await keycloak.loadUserProfile();
		log.info(KEYCLOAK_LOG, 'User profile updated');
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.error(KEYCLOAK_LOG, 'Failed to load user profile', err);
	}
}

export function getAuthHeader(): Record<string, string> {
	const token = getToken();
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

export default keycloak;
