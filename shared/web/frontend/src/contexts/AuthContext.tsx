/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React context для текущей Keycloak/OIDC сессии: синхронизирует профиль пользователя,
 * auth callbacks и публичные login/logout методы для UI. On principal id change without
 * full logout, clears auth-bound caches via `executePrincipalChangeCacheReset` before commit.
 *
 * Invariants:
 * - Login из UI идёт через единый `beginInteractiveLogin`; прямой `authSession.login` остаётся внутри auth facade/helper.
 * - Manual login defaults to sessionStorage; durable localStorage tokens require explicit `persistSession: true`.
 * - Logout clears React Query and auth-bound caches via `executeAuthSessionTermination` (AuthSessionCoordinator kill switch).
 * - Logout invokes `clearDesktopShellStateCache()` (shell/API/music IDB session caches),
 *   `clearPrincipalScopedLocalStorage()` (companion/Poemma/desktop user-content LS islands),
 *   and `clearIdentityAndSessionKeys()` (GAF Chat E2EE crypto material in LS).
 * - Principal change (sub switch without logout): `executePrincipalChangeCacheReset({ principalId: previous })`
 *   before `commitAuthSnapshot` when previous ≠ next; same principal / first login / silent token refresh — no reset.
 *
 * Related:
 * - `services/keycloak.ts`, `services/auth/authSessionCoordinator.ts`, `services/authSession.ts`, `utils/authRedirect.ts`
 * - `pages/Desktop/components/GAFChat/GAFChatCrypto.ts`
 * - `documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md` §3.4 / §8
 */

import * as React from 'react';
import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	useRef,
	type ReactNode,
} from 'react';
import {
	keycloak as authSession,
	getUserInfo,
	getToken,
	logout as authSessionLogout,
	isAuthenticated as isAuthSessionAuthenticated,
	recoverMobileEmbeddedSession,
	subscribeTokenExpired,
} from '../services/keycloak';
import type { User } from '../services';
import profileService, {
	PROFILE_ME_QUERY_KEY,
	PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
	PROFILE_PREFERENCES_QUERY_KEY,
} from '../services/profileService';
import { DESKTOP_SHELL_BOOTSTRAP_STALE_MS } from '../pages/Desktop/services/desktopShellQueryFreshness';
import type { UserProfileResponse } from '../types/profile';
import { log } from '../utils/logger';
import {
	beginInteractiveLogin,
	markExplicitLogoutPending,
	resolveDefaultOidcRedirectUri,
} from '../utils/authRedirect';
import { mapTokenRolesToUserRole } from '../utils/ugsAdminAccess';
import { isEmbeddedEliteEWClient } from '../utils/eliteewEmbeddedClient';
import { showSessionExpiredRedirectToast } from '../services/auth/sessionAuthToasts';
import {
	executeAuthSessionTermination,
	executePrincipalChangeCacheReset,
} from '../services/auth/authSessionCoordinator';
import {
	isAuthSessionLocked,
	clearAuthSessionHttpFreeze,
} from '../services/auth/authSessionLock';
import { clearNotificationStore } from '../notifications/context';
import { SsoSessionReplaceConfirmHost } from '../components/auth/SsoSessionReplaceConfirmHost';
import { queryClient } from '../providers/QueryProvider';

const AUTH_LOG_COMPONENT = 'AuthContext';

/** Слияние ответа GET /profile/me в объект User (отображаемое имя из full_name). */
function asUserRole(
	value: string | undefined | null,
	fallback: User['role']
): User['role'] {
	const trimmed = value?.trim();
	if (
		trimmed === 'admin' ||
		trimmed === 'emperyworld_admin' ||
		trimmed === 'emperyworld_member' ||
		trimmed === 'ai_agent'
	) {
		return trimmed;
	}
	return fallback;
}

function mergeProfileIntoUser(prev: User, profile: UserProfileResponse): User {
	const fromDb = profile.full_name?.trim();
	const displayName =
		fromDb && fromDb.length > 0
			? fromDb
			: prev.profile?.display_name?.trim() ||
				prev.username ||
				prev.email?.split('@')[0] ||
				'user';
	return {
		...prev,
		role: asUserRole(profile.role, prev.role),
		profile: {
			...prev.profile,
			display_name: displayName,
			avatar_url: profile.avatar_url ?? prev.profile?.avatar_url,
			bio: profile.bio ?? prev.profile?.bio,
			preferences:
				(profile.preferences as Record<string, unknown>) ??
				prev.profile?.preferences ??
				{},
		},
	};
}

/** До прихода full_name из API: не подставлять token.name, если он совпадает с логином. */
function authFallbackDisplayName(
	userInfo: NonNullable<ReturnType<typeof getUserInfo>>
): string {
	const kcUser = (
		userInfo.username ||
		userInfo.email?.split('@')[0] ||
		'user'
	).trim();
	const fromParts = [userInfo.firstName, userInfo.lastName]
		.filter(Boolean)
		.join(' ')
		.trim();
	const tokenName = userInfo.name?.trim();
	const nameDistinct =
		tokenName && kcUser && tokenName.toLowerCase() !== kcUser.toLowerCase()
			? tokenName
			: '';
	return fromParts || nameDistinct || kcUser || 'user';
}

/** Сравнение полей, которые реально приходят из GET /profile/me в mergeProfileIntoUser. */
function authUserProfileVisualEquals(a: User, b: User): boolean {
	const pa = a.profile;
	const pb = b.profile;
	if (
		(a.profile?.display_name?.trim() ?? '') !==
		(b.profile?.display_name?.trim() ?? '')
	) {
		return false;
	}
	if ((pa?.avatar_url ?? null) !== (pb?.avatar_url ?? null)) return false;
	if ((pa?.bio ?? null) !== (pb?.bio ?? null)) return false;
	if ((a.role ?? '') !== (b.role ?? '')) return false;
	return (
		JSON.stringify(pa?.preferences ?? {}) ===
		JSON.stringify(pb?.preferences ?? {})
	);
}

interface AuthContextType {
	isAuthenticated: boolean;
	user: User | null;
	token: string | null;
	/** True while auth session is tearing down — block new auth-bound requests in UI. */
	isAuthenticating: boolean;
	login: (redirectPath?: string, persistSession?: boolean) => void;
	logout: () => Promise<void>;
	loading: boolean;
	checkAuthentication: (options?: { silent?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);

	const fetchAndApplyProfile = useCallback(async (): Promise<void> => {
		try {
			const { ensureDesktopShellBootstrap } = await import(
				'../pages/Desktop/services/desktopShellBootstrap'
			);
			await ensureDesktopShellBootstrap();
			const profile = await queryClient.fetchQuery({
				queryKey: PROFILE_ME_QUERY_KEY,
				queryFn: () => profileService.getProfile(),
				staleTime: DESKTOP_SHELL_BOOTSTRAP_STALE_MS,
			});
			setUser((prev) => {
				if (!prev) return prev;
				const merged = mergeProfileIntoUser(prev, profile);
				return authUserProfileVisualEquals(prev, merged) ? prev : merged;
			});
		} catch {
			// Сеть / 401 — остаётся отображение из токена
		}
	}, []);
	// Держим loading=true до первой синхронизации с auth session, чтобы дочерние хуки
	// не успели принять временный "неавторизован" за окончательное состояние.
	const [loading, setLoading] = useState(true);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const hadAuthenticatedRef = useRef(false);
	const lastPrincipalIdRef = useRef<string | null>(null);
	const authStateRef = useRef({ isAuthenticated, user, token });
	authStateRef.current = { isAuthenticated, user, token };

	type AuthSnapshot = {
		isAuthenticated: boolean;
		user: User | null;
		token: string | null;
		loading: boolean;
	};

	const commitAuthSnapshot = useCallback((snapshot: AuthSnapshot) => {
		setIsAuthenticated(snapshot.isAuthenticated);
		setUser(snapshot.user);
		setToken(snapshot.token);
		setLoading(snapshot.loading);
	}, []);

	const applyAuthSessionTeardown = useCallback((principalId: string | null) => {
		setIsAuthenticating(true);
		executeAuthSessionTermination({ principalId });
		setIsAuthenticated(false);
		setUser(null);
		setToken(null);
		setLoading(false);
		setIsAuthenticating(false);
	}, []);

	useEffect(() => {
		lastPrincipalIdRef.current = user?.id?.trim() || null;
	}, [user]);

	type SyncOptions = {
		/** Skip full-screen loading when session was already established (embedded refresh). */
		silent?: boolean;
	};

	/**
	 * Sync state with auth session facade
	 *
	 * ЕДИНСТВЕННЫЙ источник правды - authSession.token и authSession.tokenParsed
	 * НЕТ проверок localStorage/window/global SDK
	 *
	 * ⚡ ОПТИМИЗАЦИЯ: auth init уже инициализировал сессию, поэтому синхронизация быстрая
	 */
	const syncWithAuthSession = useCallback(
		async (options?: SyncOptions) => {
			const silent =
				options?.silent ??
				(hadAuthenticatedRef.current && isEmbeddedEliteEWClient());
			if (isAuthSessionLocked()) {
				if (!silent) {
					commitAuthSnapshot({
						isAuthenticated: false,
						user: null,
						token: null,
						loading: false,
					});
				}
				return;
			}
			if (!silent) {
				commitAuthSnapshot({
					...authStateRef.current,
					loading: true,
				});
			}
			try {
				let authenticated = isAuthSessionAuthenticated();
				if (!authenticated && isEmbeddedEliteEWClient()) {
					await recoverMobileEmbeddedSession();
					authenticated = isAuthSessionAuthenticated();
				}

				let nextSnapshot: AuthSnapshot = {
					isAuthenticated: false,
					user: null,
					token: null,
					loading: false,
				};

				if (authenticated) {
					const userInfo = getUserInfo();
					const currentToken = getToken();
					const resolvedUserId =
						userInfo?.id?.trim() ||
						userInfo?.username?.trim() ||
						(isEmbeddedEliteEWClient() ? 'mobile-embedded-session' : '');

					// Keycloak маппер email в access token может отсутствовать при узком scope;
					// без саба / токена в контекст не поднимаем, email добираем из profile/me или placeholder.
					if (userInfo && currentToken && resolvedUserId) {
						const emailRaw =
							userInfo.email?.trim() ||
							(userInfo.username?.includes('@')
								? userInfo.username.trim()
								: '');
						const resolvedEmail =
							emailRaw ||
							`${userInfo.id.replace(/[^a-zA-Z0-9-]/g, '_')}@sso.pending`;
						if (!emailRaw) {
							log.warn(
								AUTH_LOG_COMPONENT,
								'JWT без email — временный placeholder до GET /profile/me'
							);
						}

						const fallbackDisplay = authFallbackDisplayName(userInfo);

						const resolvedUser: User = {
							id: resolvedUserId,
							email: resolvedEmail,
							username:
								userInfo.username || userInfo.email?.split('@')[0] || 'user',
							role: mapTokenRolesToUserRole(userInfo.roles),
							is_active: true,
							created_at: new Date().toISOString(),
							profile: {
								display_name: fallbackDisplay,
								avatar_url: undefined,
								bio: undefined,
								preferences: {},
							},
						};

						nextSnapshot = {
							isAuthenticated: true,
							user: resolvedUser,
							token: currentToken,
							loading: false,
						};
						hadAuthenticatedRef.current = true;
						clearAuthSessionHttpFreeze();

						const previousPrincipalId =
							authStateRef.current.user?.id?.trim() ||
							lastPrincipalIdRef.current;
						const nextPrincipalId = resolvedUserId;
						if (
							previousPrincipalId &&
							nextPrincipalId &&
							previousPrincipalId !== nextPrincipalId
						) {
							executePrincipalChangeCacheReset({
								principalId: previousPrincipalId,
							});
						}

						log.info(
							AUTH_LOG_COMPONENT,
							'✅ User authenticated via auth session facade'
						);
						log.info(AUTH_LOG_COMPONENT, `👤 User: ${resolvedUser.email}`);
						const tokenExp = authSession.tokenParsed?.exp;
						if (tokenExp) {
							const secondsLeft = Math.round(tokenExp - Date.now() / 1000);
							log.info(
								AUTH_LOG_COMPONENT,
								`🎫 Token expires in: ${secondsLeft} seconds`
							);
						}
					} else if (currentToken && isEmbeddedEliteEWClient()) {
						log.warn(
							AUTH_LOG_COMPONENT,
							'Embedded EWA: authenticated token without parseable userInfo — minimal session'
						);
						hadAuthenticatedRef.current = true;
						nextSnapshot = {
							isAuthenticated: true,
							user: {
								id: 'mobile-embedded-session',
								email: 'embedded@eliteew.local',
								username: 'mobile',
								role: 'emperyworld_member',
								is_active: true,
								created_at: new Date().toISOString(),
								profile: {
									display_name: 'EWA',
									avatar_url: undefined,
									bio: undefined,
									preferences: {},
								},
							},
							token: currentToken,
							loading: false,
						};
					} else if (currentToken) {
						log.warn(
							AUTH_LOG_COMPONENT,
							'Фасад authenticated, но нет userInfo/sub — проверьте payload JWT'
						);
					}
				} else {
					clearNotificationStore();
					log.info(AUTH_LOG_COMPONENT, 'ℹ️ User not authenticated');
				}

				if (
					nextSnapshot.isAuthenticated &&
					nextSnapshot.token &&
					!isEmbeddedEliteEWClient()
				) {
					const { getOidcRuntimeProfile } = await import(
						'@/services/keycloakProfile'
					);
					const oidcProfile = getOidcRuntimeProfile();
					if (
						oidcProfile === 'desktopNative' ||
						oidcProfile === 'foflineNative'
					) {
						const { hasDesktopNativeOidcBridge } = await import(
							'@/services/keycloakDesktopNativeOidc'
						);
						if (!hasDesktopNativeOidcBridge()) {
							// Hold consumer isAuthenticated until leftover session/assert OK (no BAC flash).
							commitAuthSnapshot({
								...nextSnapshot,
								isAuthenticated: false,
								loading: true,
							});
							const { assertDesktopClientSessionIfNeeded } = await import(
								'@/services/desktopClient/desktopClientSessionAssert'
							);
							const assertResult = await assertDesktopClientSessionIfNeeded();
							if (!assertResult?.ok) {
								log.warn(
									AUTH_LOG_COMPONENT,
									`native shell session assert blocked auth: ${assertResult?.code ?? 'unknown'}`
								);
								commitAuthSnapshot({
									isAuthenticated: false,
									user: null,
									token: null,
									loading: false,
								});
								return;
							}
						}
					}
				}

				commitAuthSnapshot(nextSnapshot);
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				log.error(AUTH_LOG_COMPONENT, '❌ Sync failed', err);
				clearNotificationStore();
				commitAuthSnapshot({
					isAuthenticated: false,
					user: null,
					token: null,
					loading: false,
				});
			}
		},
		[commitAuthSnapshot]
	);

	// GET /profile/me через React Query (дедупликация, кэш) — источник отображаемого имени из БД.
	// Clear shell-bootstrap only after a real logout (had authenticated before).
	// Initial mount isAuthenticated=false must NOT clear: async clear raced the first
	// ensure and produced shell-bootstrap ×2 + fallback notification-center / gaf chats GETs.
	useEffect(() => {
		if (!isAuthenticated) {
			if (!hadAuthenticatedRef.current) {
				return;
			}
			void import('../pages/Desktop/services/desktopShellBootstrap').then(
				({ clearDesktopShellBootstrapCache }) => {
					clearDesktopShellBootstrapCache();
				}
			);
			queryClient.removeQueries({ queryKey: PROFILE_ME_QUERY_KEY });
			queryClient.removeQueries({
				queryKey: PROFILE_PREFERENCES_QUERY_KEY,
			});
			queryClient.removeQueries({
				queryKey: PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
			});
			return;
		}
		if (!token) {
			return;
		}
		void fetchAndApplyProfile();
		// Native license assert runs inside syncWithAuthSession before isAuthenticated=true.
	}, [isAuthenticated, token, fetchAndApplyProfile]);

	// Initialize on mount
	useEffect(() => {
		log.info(AUTH_LOG_COMPONENT, '🔐 Initializing with auth session facade');

		// Bounded OIDC bootstrap already ran initKeycloak — avoid re-flashing loading:true on mount.
		void syncWithAuthSession({ silent: true });

		// Listen to auth session events
		authSession.onAuthSuccess = () => {
			clearAuthSessionHttpFreeze();
			log.info(AUTH_LOG_COMPONENT, '✅ auth session success');
			void syncWithAuthSession().then(async () => {
				try {
					const { consumeWebSsoRecoveryCapsule, applyConsumedRecoveryCapsule } =
						await import('../services/auth/webSsoRecoveryCapsule');
					const { clearSessionEndedPending } = await import(
						'../utils/authRedirect'
					);
					const consumed = await consumeWebSsoRecoveryCapsule();
					if (consumed.found && consumed.payload) {
						await applyConsumedRecoveryCapsule(consumed.payload);
						clearSessionEndedPending();
						log.info(
							AUTH_LOG_COMPONENT,
							'Continuity W3 recovery capsule restored'
						);
					}
				} catch (error) {
					log.warn(
						AUTH_LOG_COMPONENT,
						'Continuity W3 capsule consume failed',
						error
					);
				}
			});
		};

		authSession.onAuthRefreshSuccess = () => {
			if (isAuthSessionLocked()) {
				return;
			}
			void syncWithAuthSession({ silent: true });
			void import('../services/auth/webSsoRecoveryCapsule').then(
				({ flushWebSsoRecoveryCapsule }) => {
					void flushWebSsoRecoveryCapsule('soft_checkpoint');
				}
			);
		};

		const handleAuthSessionFailure = () => {
			log.error(AUTH_LOG_COMPONENT, '❌ auth session error');
			if (isEmbeddedEliteEWClient()) {
				void (async () => {
					const recovered = await recoverMobileEmbeddedSession();
					if (recovered && isAuthSessionAuthenticated()) {
						log.info(
							AUTH_LOG_COMPONENT,
							'Embedded EWA: recovered session after auth error'
						);
						await syncWithAuthSession({ silent: true });
						return;
					}
					applyAuthSessionTeardown(lastPrincipalIdRef.current);
				})();
				return;
			}
			applyAuthSessionTeardown(lastPrincipalIdRef.current);
		};

		authSession.onAuthError = handleAuthSessionFailure;
		// Continuity W3: browser refresh terminal path is owned by callers that
		// still have the OAuth error (timer / tokenExpired). Tearing down here
		// would clear a valid session on network-classified refresh failures.
		authSession.onAuthRefreshError = () => {
			if (isEmbeddedEliteEWClient()) {
				handleAuthSessionFailure();
				return;
			}
			log.warn(
				AUTH_LOG_COMPONENT,
				'onAuthRefreshError (browser): deferred to classified terminal teardown'
			);
		};

		authSession.onAuthLogout = () => {
			log.info(AUTH_LOG_COMPONENT, 'Auth session cleared');
			applyAuthSessionTeardown(lastPrincipalIdRef.current);
		};

		const unsubscribeTokenExpired = subscribeTokenExpired(() => {
			log.warn(AUTH_LOG_COMPONENT, '⚠️ Token expired, refreshing...');
			authSession
				.updateToken(30)
				.then(() => {
					log.info(AUTH_LOG_COMPONENT, '✅ Token refreshed');
					void syncWithAuthSession({ silent: true });
				})
				.catch(async (error) => {
					const err = error instanceof Error ? error : new Error(String(error));
					log.error(AUTH_LOG_COMPONENT, '❌ Token refresh failed', err);
					if (isEmbeddedEliteEWClient()) {
						const recovered = await recoverMobileEmbeddedSession();
						if (recovered && isAuthSessionAuthenticated()) {
							log.info(
								AUTH_LOG_COMPONENT,
								'Embedded EWA: recovered session after token expiry'
							);
							await syncWithAuthSession({ silent: true });
							return;
						}
					}
					log.warn(
						AUTH_LOG_COMPONENT,
						'🔄 Refresh token expired — Continuity W3 terminal teardown'
					);
					showSessionExpiredRedirectToast();
					const { handleBrowserTerminalRefreshFailure } = await import(
						'../services/auth/webSsoTerminalTeardown'
					);
					await handleBrowserTerminalRefreshFailure({
						error,
						clearSession: () => {
							authSession.clearToken(true);
						},
					});
				});
		});

		return () => {
			// Cleanup listeners
			unsubscribeTokenExpired();
			authSession.onAuthSuccess = undefined;
			authSession.onAuthRefreshSuccess = undefined;
			authSession.onAuthError = undefined;
			authSession.onAuthRefreshError = undefined;
			authSession.onAuthLogout = undefined;
		};
	}, [syncWithAuthSession, applyAuthSessionTeardown]);

	/**
	 * Login - redirect to auth provider
	 */
	const login = (redirectPath?: string, persistSession = false) => {
		log.info(AUTH_LOG_COMPONENT, '🔐 Redirecting to auth login...');
		beginInteractiveLogin('manual_login', {
			redirectUri: redirectPath
				? resolveDefaultOidcRedirectUri(undefined, redirectPath)
				: resolveDefaultOidcRedirectUri(),
			persistSession,
		});
	};

	/**
	 * Logout flow
	 */
	const logout = async () => {
		const principalId = user?.id?.trim() || lastPrincipalIdRef.current;
		try {
			log.info(AUTH_LOG_COMPONENT, '🚪 Logging out...');
			markExplicitLogoutPending();
			await authSessionLogout();
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			log.error(AUTH_LOG_COMPONENT, '❌ Logout error', err);
			applyAuthSessionTeardown(principalId);
		}
	};

	/**
	 * Re-check authentication status.
	 * Use `{ silent: true }` on proactive token refresh — never flash AppRouter loading
	 * and unmount DesktopWorkspace (~600s metronome with 900s AT + 5m warning).
	 */
	const checkAuthentication = async (options?: { silent?: boolean }) => {
		log.info(AUTH_LOG_COMPONENT, '🔍 Checking authentication status...');
		await syncWithAuthSession(options);
		if (isAuthSessionAuthenticated() && getToken()) {
			await fetchAndApplyProfile();
		}
	};

	const contextValue: AuthContextType = {
		isAuthenticated,
		user,
		token,
		isAuthenticating,
		login,
		logout,
		loading,
		checkAuthentication,
	};

	return (
		<AuthContext.Provider value={contextValue}>
			<SsoSessionReplaceConfirmHost />
			{children}
		</AuthContext.Provider>
	);
};

export const useOptionalAuth = (): AuthContextType | null => {
	return useContext(AuthContext) ?? null;
};

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};

// Helper function to get auth headers for API calls
export const getAuthHeaders = (token: string | null) => {
	if (!token) {
		return {};
	}

	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
};
