/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 26: Axios createAPIClient factory (request/response interceptors, Bearer, retry).
 *
 * Invariants:
 * - Relative per-request baseURL absolutized on fofline-spa/Tauri via resolveAbsoluteApiBaseURL.
 * - Multipart uses API_CONFIG.uploadTimeout when caller omits custom timeout.
 *
 * Related:
 * - apiClientCore.ts, client.ts, documentation/api/FRONTEND-BACKEND-HTTP.md
 */
import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosRequestConfig,
	type AxiosResponse,
} from 'axios';
import { log, logUxError } from '../../utils/logger';
import { getAppBuildId } from '../../utils/appBuildId';
import { notifySoftAppBuildMismatchFromHeaders } from '../../utils/softAppBuildMismatchToast';
import {
	FOLLOWER_TAB_PASSIVE_MODE,
	shouldBlockSingleTabApi,
} from '../../utils/browserTabLeaderState';
import { reloadAllAppTabs } from '../../utils/staleBundleReload';
import {
	maintenanceStatusFromHttpError,
	publishMaintenanceStatus,
} from '../maintenance/maintenanceState';
import { publishUnplannedMaintenanceFromHttpError } from '../maintenance/recoveryNotificationGuard';
import authSession from '../authSession';
import {
	hasActiveSessionReplaceConfirmation,
	SESSION_REPLACE_CONFIRM_HEADER,
	setSessionReplaceXorPartner,
} from '../auth/ssoSessionReplaceConfirm';
import { isAuthSessionLocked } from '../auth/authSessionLock';
import { registerActiveRequestAbortController } from '../auth/authSessionHttpAbort';
import { beginInteractiveLogin } from '../../utils/authRedirect';
import { API_CONFIG, resolveAbsoluteApiBaseURL } from './config';
import { rewriteSiteStudioProxyUrl } from './siteStudioProxy';
import {
	APIError,
	confirmSessionReplaceAndRetry,
	getRetryDelay,
	handleAPIError,
	handleSessionReplaced,
	isDbSchemaMigrationUnavailable,
	isRequestAborted,
	parseAuthErrorBody,
	releaseRequestAbortRegistration,
	saveIntendedPageAndLogout,
	shouldRetry,
	shouldSkip403AuthRedirect,
} from './apiClientCore';

/**
 * Create API Client
 */
export const createAPIClient = (config?: AxiosRequestConfig): AxiosInstance => {
	// Helper to ensure HTTPS
	const ensureHttps = (url: string | undefined): string | undefined => {
		if (!url) {
			return url;
		}
		if (url.startsWith('http://')) {
			log.warn('APIClient', `⚠️ [APIClient] Converting HTTP to HTTPS: ${url}`);
			return url.replace('http://', 'https://');
		}
		if (url.startsWith('//')) {
			return `https:${url}`;
		}
		if (url.includes('app.eliteew.ru') && url.includes('http://')) {
			log.warn(
				'APIClient',
				`⚠️ [APIClient] Fixing HTTP URL for app.eliteew.ru: ${url}`
			);
			return url.replace('http://app.eliteew.ru', 'https://app.eliteew.ru');
		}
		return url;
	};

	const baseURL =
		config?.baseURL !== undefined
			? ensureHttps(config.baseURL as string)
			: ensureHttps(API_CONFIG.mainApiBaseURL);
	const client = axios.create({
		baseURL,
		timeout: API_CONFIG.timeout,
		headers: {
			'Content-Type': 'application/json',
		},
		withCredentials: false, // Auth session uses Bearer token, not cookies
		...config,
	});
	client.defaults.baseURL = baseURL;
	client.defaults.timeout =
		config?.timeout !== undefined && config?.timeout !== null
			? config.timeout
			: API_CONFIG.timeout;

	// Request Interceptor - ASYNC для правильного обновления токена
	client.interceptors.request.use(
		async (config) => {
			if (isAuthSessionLocked()) {
				return Promise.reject(new Error('auth_session_teardown_in_progress'));
			}

			const { signal, release } = registerActiveRequestAbortController(
				config.signal as AbortSignal | undefined
			);
			config.signal = signal;
			config.metadata = {
				...(config.metadata ?? { startTime: Date.now() }),
				startTime: config.metadata?.startTime ?? Date.now(),
				releaseAuthAbort: release,
			};

			// Ensure HTTPS
			if (config.url) {
				config.url = rewriteSiteStudioProxyUrl(
					config.url,
					typeof config.baseURL === 'string' ? config.baseURL : undefined
				);
			}
			if (config.url) {
				config.url = ensureHttps(config.url);
			}
			if (config.baseURL !== undefined && config.baseURL !== null) {
				config.baseURL = ensureHttps(
					resolveAbsoluteApiBaseURL(String(config.baseURL))
				);
			}

			// Remove duplicate baseURL prefix if URL already starts with it
			if (
				config.url &&
				config.baseURL &&
				config.url.startsWith(config.baseURL)
			) {
				config.url = config.url.substring(config.baseURL.length);
				if (!config.url.startsWith('/')) config.url = `/${config.url}`;
			}

			// Long authenticated file transfers (APK/audio/video) must not be cut by the default 30s timeout.
			const expectsBinaryResponse =
				config.responseType === 'blob' || config.responseType === 'arraybuffer';
			if (
				expectsBinaryResponse &&
				(config.timeout == null || config.timeout === API_CONFIG.timeout)
			) {
				config.timeout = 0;
			}

			// Multipart uploads (GAF chat, Content Manager, avatar): default 30s is too short on slow networks.
			const method = (config.method ?? 'get').toLowerCase();
			const isMultipartUpload =
				typeof FormData !== 'undefined' &&
				config.data instanceof FormData &&
				(method === 'post' || method === 'put' || method === 'patch');
			if (
				isMultipartUpload &&
				(config.timeout == null || config.timeout === API_CONFIG.timeout)
			) {
				config.timeout = API_CONFIG.uploadTimeout;
			}

			// 🔐 Add Bearer token from auth session
			// ✅ FIX: Считаем API-запросом и url вида /api/..., и запросы с baseURL на /api (например /api/v1 для desktop)
			const urlIsApi =
				config.url &&
				(config.url.startsWith('/api') || config.url.includes('/api/'));
			const baseURLIsApi =
				config.baseURL &&
				typeof config.baseURL === 'string' &&
				config.baseURL.indexOf('/api') !== -1;
			const isAPIRequest = !!urlIsApi || !!baseURLIsApi;

			if (isAPIRequest && !authSession.authenticated) {
				if (import.meta.env.DEV) {
					log.warn(
						'APIClient',
						'⚠️ [API] User not authenticated for API request',
						{ url: config.url }
					);
				}

				return Promise.reject(
					new Error('User not authenticated - request skipped')
				);
			}

			// ✅ FIX: Кэшируем проверку exp, чтобы не проверять на каждом запросе
			if (authSession.authenticated) {
				try {
					// ✅ FIX: Используем кэшированную проверку exp (проверяем раз в минуту)
					const { getCachedTimeUntilExpiry } = await import(
						'../../utils/tokenCache'
					);
					const tokenExp = authSession.tokenParsed?.exp;
					const timeUntilExpiry = tokenExp
						? getCachedTimeUntilExpiry(tokenExp)
						: 0;

					// Update token if it's expired or will expire soon (WAIT for it!)
					if (timeUntilExpiry < 70) {
						try {
							await authSession.updateToken(70);
							// ✅ FIX: Логируем только в DEV
							if (import.meta.env.DEV) {
								log.info('APIClient', '✅ Token refreshed before request');
							}
							// Сбрасываем кэш после обновления токена
							const { clearTokenCache } = await import(
								'../../utils/tokenCache'
							);
							clearTokenCache();
						} catch (err) {
							if (import.meta.env.DEV) {
								log.warn(
									'APIClient',
									'⚠️ Token refresh failed before request',
									err
								);
							}
							// Don't redirect here - let 401 handler deal with it
						}
					}

					// Add token to request (after potential refresh)
					if (authSession.token) {
						config.headers.Authorization = `Bearer ${authSession.token}`;
						// ✅ FIX: Логируем только в DEV режиме, чтобы не засорять консоль
						if (import.meta.env.DEV) {
							log.info(
								'APIClient',
								`🔐 [API] Token added to ${config.method?.toUpperCase()} ${config.url}`
							);
						}
					} else {
						log.error(
							'APIClient',
							'❌ Auth session authenticated but no token available after refresh attempt'
						);
						log.error('APIClient', '❌ Auth session state', undefined, {
							authenticated: authSession.authenticated,
							hasToken: !!authSession.token,
							tokenParsed: !!authSession.tokenParsed,
							tokenExp: tokenExp,
							timeUntilExpiry: timeUntilExpiry,
						});
					}
				} catch (err) {
					log.error(
						'APIClient',
						'❌ Error handling auth session token',
						err as Error
					);
				}
			} else if (isAPIRequest) {
				// DIAGNOSTIC: Log when not authenticated
				if (import.meta.env.DEV) {
					log.warn(
						'APIClient',
						`⚠️ [API] Request to ${config.url} without authentication (authSession.authenticated = false)`
					);
				}
			}

			// Add request timestamp for performance tracking
			config.metadata = { startTime: Date.now() };

			// Add custom headers if needed
			// Example: Add correlation ID for tracing
			if (!config.headers['X-Request-ID']) {
				config.headers['X-Request-ID'] =
					`req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			}

			if (isAPIRequest) {
				if (
					config._retrySessionReplaceConfirm ||
					hasActiveSessionReplaceConfirmation()
				) {
					config.headers[SESSION_REPLACE_CONFIRM_HEADER] = '1';
				}
				const requestPath = `${config.url ?? ''}`;
				const requestBaseUrl = `${config.baseURL ?? ''}`;
				if (
					shouldBlockSingleTabApi(requestPath, config.method, requestBaseUrl)
				) {
					return Promise.reject(new axios.Cancel(FOLLOWER_TAB_PASSIVE_MODE));
				}
				config.headers['X-App-Build'] = getAppBuildId();
			}

			// Session-scoped GETs: never allow browser/proxy JSON cache reuse
			const pathForCachePolicy = `${config.url ?? ''}`;
			if (
				pathForCachePolicy.includes('/desktop/admin/') ||
				pathForCachePolicy.includes('/professional-worlds/admin/') ||
				pathForCachePolicy.includes('/mobile-devices') ||
				pathForCachePolicy.includes('/mobile-app/')
			) {
				config.headers['Cache-Control'] = 'no-cache, no-store';
				config.headers.Pragma = 'no-cache';
			}

			// When sending FormData, let axios set Content-Type with boundary (default application/json would cause 422)
			if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
				delete config.headers['Content-Type'];
			}

			return config;
		},
		(error) => {
			return Promise.reject(error);
		}
	);

	// Response Interceptor
	client.interceptors.response.use(
		(response: AxiosResponse) => {
			// Track response time
			const requestConfig = response.config;
			releaseRequestAbortRegistration(requestConfig);
			if (requestConfig.metadata?.startTime) {
				const duration = Date.now() - requestConfig.metadata.startTime;
				log.debug(
					'APIClient',
					`ℹ️ [API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`
				);
			}

			try {
				notifySoftAppBuildMismatchFromHeaders(response.headers);
			} catch {
				/* ignore toast helper failures */
			}

			return response;
		},
		async (error: AxiosError) => {
			releaseRequestAbortRegistration(error.config);

			if (isRequestAborted(error)) {
				return Promise.reject(error);
			}

			if (isAuthSessionLocked()) {
				return Promise.reject(error);
			}

			const config = error.config;
			if (!config) {
				return Promise.reject(error);
			}

			if (error.response?.status === 503) {
				const ssoRegistryAuth = parseAuthErrorBody(error.response.data);
				// Fail-closed registry outage — not planned maintenance overlay.
				if (ssoRegistryAuth?.reason !== 'sso_registry_unavailable') {
					const maintenanceStatus = maintenanceStatusFromHttpError(
						error.response.data
					);
					if (maintenanceStatus.active) {
						publishMaintenanceStatus(maintenanceStatus);
						return Promise.reject(error);
					}
				}
			}

			if (
				error.response?.status &&
				[502, 503, 504].includes(error.response.status) &&
				!isDbSchemaMigrationUnavailable(error)
			) {
				const ssoRegistryAuth = parseAuthErrorBody(error.response.data);
				if (ssoRegistryAuth?.reason !== 'sso_registry_unavailable') {
					const retryAfterRaw = error.response.headers?.['retry-after'];
					const retryAfter =
						typeof retryAfterRaw === 'string' && /^\d+$/.test(retryAfterRaw)
							? Number(retryAfterRaw)
							: 60;
					publishUnplannedMaintenanceFromHttpError(
						error.response.status,
						retryAfter
					);
				}
			}

			if (error.response?.status === 409) {
				const authBody = parseAuthErrorBody(error.response?.data);
				if (authBody?.reason === 'session_replace_confirmation_required') {
					// Middleware returns 409 for XOR confirm; partner must arm dialog copy
					// (401 path below sets the same field for legacy / alternate responses).
					setSessionReplaceXorPartner(authBody.xor_partner ?? null);
					const retried = await confirmSessionReplaceAndRetry(client, config);
					if (retried) {
						return retried;
					}
					return Promise.reject(error);
				}
				const body = error.response.data;
				if (
					body &&
					typeof body === 'object' &&
					'code' in body &&
					(body as { code?: string }).code === 'client_stale'
				) {
					log.warn('APIClient', 'Stale SPA bundle rejected by API — reloading');
					reloadAllAppTabs('client_stale_http');
					return Promise.reject(error);
				}
			}

			// FIX 401: Handle unauthorized errors - try to refresh token and retry
			// PREVENT INFINITE REDIRECT: Check if we already tried to refresh
			if (error.response?.status === 401) {
				const authBody = parseAuthErrorBody(error.response?.data);
				if (authBody?.reason === 'session_replace_confirmation_required') {
					setSessionReplaceXorPartner(authBody.xor_partner ?? null);
					const retried = await confirmSessionReplaceAndRetry(client, config);
					if (retried) {
						return retried;
					}
					return Promise.reject(error);
				}
				if (authBody?.reason === 'session_replaced') {
					log.warn('APIClient', 'Session was replaced by a newer login');
					handleSessionReplaced(authBody.displaced_by);
					return Promise.reject(error);
				}

				// Mark that we're handling this 401 to prevent infinite loop
				if (!config._retryAuth) {
					config._retryAuth = true;

					// Try silent refresh unless the token was never sent (token_missing).
					// Backend uses action=refresh for token_expired; older responses used action=login for the same case — still refresh.
					const shouldTryRefresh =
						authSession.authenticated && authBody?.reason !== 'token_missing';

					if (shouldTryRefresh) {
						try {
							log.warn(
								'APIClient',
								'⚠️ 401 Unauthorized - attempting token refresh...'
							);
							const refreshed = await authSession.updateToken(70);

							if (refreshed && authSession.token) {
								log.info('APIClient', 'Token refreshed, retrying request');
								config.headers.Authorization = `Bearer ${authSession.token}`;
								config._retryAuth = false;
								return client.request(config);
							} else {
								log.warn(
									'APIClient',
									'Token refresh failed or no token available'
								);
								saveIntendedPageAndLogout();
								return Promise.reject(error);
							}
						} catch (refreshError) {
							log.error(
								'APIClient',
								'Token refresh error',
								refreshError as Error
							);
							saveIntendedPageAndLogout();
							return Promise.reject(error);
						}
					} else {
						if (authSession.authenticated) {
							logUxError('API', 'auth', 'redirect_after_401', error, {
								endpoint: config?.url,
							});
							beginInteractiveLogin('api_401');
						}
						return Promise.reject(error);
					}
				} else {
					// Already tried to refresh - prevent infinite loop
					log.error(
						'APIClient',
						'❌ 401 Unauthorized after token refresh attempt - preventing infinite redirect'
					);
					return Promise.reject(error);
				}
			}

			// 403: unified auth body may request login (e.g. session/role change)
			if (error.response?.status === 403) {
				const authBody = parseAuthErrorBody(error.response?.data);
				const url = config?.url ?? '';
				if (
					authBody?.action === 'login' &&
					!shouldSkip403AuthRedirect(url, error.response?.data)
				) {
					logUxError('API', 'auth', 'redirect_after_403', error, {
						endpoint: config?.url,
					});
					beginInteractiveLogin('api_403');
					return Promise.reject(error);
				}
			}

			// Initialize retry count
			if (!config._retryCount) {
				config._retryCount = 0;
			}

			// Check if we should retry
			if (shouldRetry(error, config._retryCount + 1)) {
				config._retryCount += 1;
				const delay = getRetryDelay(config._retryCount);

				log.debug(
					'APIClient',
					`🔄 [API] Retrying request (${config._retryCount}/${API_CONFIG.retry.attempts}) after ${delay}ms`,
					{ url: config.url }
				);

				await new Promise((resolve) => setTimeout(resolve, delay));
				return client.request(config);
			}

			const isExpected404 =
				error.response?.status === 404 &&
				(config.url?.includes('/dashboard/layouts/active') ||
					/\/content\/[^/?#]+\/download(?:\?|$)/.test(config.url ?? ''));
			if (isExpected404) {
				// For expected 404s, throw APIError but don't log to console
				// The calling code will handle it gracefully
				const errorData = error.response?.data as
					| { detail?: string }
					| undefined;
				throw new APIError(
					errorData?.detail || 'Not found',
					404,
					'NOT_FOUND',
					error.response?.data,
					error,
					config.url
				);
			}

			// Handle error with custom error class
			handleAPIError(error, config.url);
		}
	);

	return client;
};
