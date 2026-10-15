/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 26: authenticated streaming fetch (apiFetchWithAuth) for SSE/long-poll paths.
 *
 * Invariants:
 * - Only page-origin or configured main API origin /api/*; FoFline/Tauri absolutize relative /api/*.
 * - Single-tab mutation gate; one 401 refresh retry; never retry 403.
 *
 * Related:
 * - apiClientCore.ts, client.ts
 */
import authSession from '../authSession';
import {
	FOLLOWER_TAB_PASSIVE_MODE,
	shouldBlockSingleTabApiMutation,
} from '../../utils/browserTabLeaderState';
import { beginInteractiveLogin } from '../../utils/authRedirect';
import { log } from '../../utils/logger';
import { isAuthSessionLocked } from '../auth/authSessionLock';
import { registerActiveRequestAbortController } from '../auth/authSessionHttpAbort';
import { getMainApiBaseURL } from './config';
import {
	handleSessionReplaced,
	isOpaqueDesktopOrigin,
	parseAuthErrorBody,
	resolveApiFetchUrlString,
	saveIntendedPageAndLogout,
} from './apiClientCore';

/**
 * Authenticated fetch for streaming / SSE endpoints.
 * Axios does not support ReadableStream in the browser; use this for /api/* streaming.
 * Uses the same auth session token as apiClient (Bearer, single 401 refresh + retry).
 * Pass `signal` in `init` for AbortController cancellation.
 */
async function apiFetchWithAuthOnce(
	input: RequestInfo | URL,
	init: RequestInit | undefined,
	retryAuth: boolean
): Promise<Response> {
	const resolvedUrl = resolveApiFetchUrlString(input);
	const url = new URL(
		resolvedUrl,
		typeof window !== 'undefined' ? window.location.href : 'http://localhost'
	);
	const main = getMainApiBaseURL().replace(/\/$/, '');
	let apiOrigin = '';
	if (main) {
		try {
			apiOrigin = new URL(main).origin;
		} catch {
			apiOrigin = '';
		}
	}
	const pageOrigin =
		typeof window !== 'undefined' ? window.location.origin : '';
	const originAllowed =
		(Boolean(pageOrigin) && url.origin === pageOrigin) ||
		(Boolean(apiOrigin) && url.origin === apiOrigin);
	if (!originAllowed || !url.pathname.startsWith('/api/')) {
		throw new Error(
			'apiFetchWithAuth only supports configured API /api/* URLs'
		);
	}
	const fetchTarget =
		isOpaqueDesktopOrigin() || /^https?:\/\//i.test(resolvedUrl)
			? url.toString()
			: resolvedUrl;

	if (isAuthSessionLocked()) {
		throw new Error('auth_session_teardown_in_progress');
	}

	const requestMethod = (init?.method ?? 'GET').toUpperCase();
	if (
		shouldBlockSingleTabApiMutation(
			`${url.pathname}${url.search}`,
			requestMethod
		)
	) {
		throw new Error(FOLLOWER_TAB_PASSIVE_MODE);
	}

	const headers = new Headers(init?.headers);
	if (authSession.authenticated && authSession.token) {
		headers.set('Authorization', `Bearer ${authSession.token}`);
	}
	const { signal, release } = registerActiveRequestAbortController(
		init?.signal ?? undefined
	);
	try {
		const response = await fetch(fetchTarget, { ...init, headers, signal });
		if (response.status === 401 && !retryAuth) {
			const authBody = parseAuthErrorBody(
				await response
					.clone()
					.json()
					.catch(() => null)
			);
			if (authBody?.reason === 'session_replaced') {
				handleSessionReplaced(authBody.displaced_by);
				return response;
			}
			if (authBody?.reason === 'session_replace_confirmation_required') {
				return response;
			}
			const shouldTryRefresh =
				authSession.authenticated && authBody?.reason !== 'token_missing';
			if (shouldTryRefresh) {
				try {
					const refreshed = await authSession.updateToken(70);
					if (refreshed && authSession.token) {
						const { clearTokenCache } = await import('../../utils/tokenCache');
						clearTokenCache();
						return apiFetchWithAuthOnce(fetchTarget, init, true);
					}
					saveIntendedPageAndLogout();
				} catch (refreshError) {
					log.error(
						'APIClient',
						'apiFetchWithAuth token refresh error',
						refreshError as Error
					);
					saveIntendedPageAndLogout();
				}
			} else if (authSession.authenticated) {
				beginInteractiveLogin('api_401');
			}
		}
		return response;
	} finally {
		release();
	}
}

export async function apiFetchWithAuth(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> {
	return apiFetchWithAuthOnce(input, init, false);
}
