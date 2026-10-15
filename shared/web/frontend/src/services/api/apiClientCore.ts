/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 26: shared Axios API client types, origin helpers, retry, and session-auth branches
 * extracted from the former monolithic client.ts.
 *
 * Invariants:
 * - Public symbols remain re-exported from ./client for stable importers.
 * - Interactive login only via beginInteractiveLogin (never raw redirect).
 *
 * Related:
 * - createAPIClient.ts, client.ts, documentation/api/FRONTEND-BACKEND-HTTP.md
 */
import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from 'axios';
import { INTENDED_PAGE_SESSION_KEY } from '../../constants/storageKeys';
import { getShellPageIdForIntendedStorage } from '../../utils/pageRouting';
import { API_CONFIG, ErrorMessages, resolveAbsoluteApiBaseURL } from './config';
import authSession, { notifySessionReplaced } from '../authSession';
import { getCurrentMaintenanceStatus } from '../maintenance/maintenanceState';
import { isAuthSessionLocked } from '../auth/authSessionLock';
import {
	clearSessionReplaceConfirmedWindow,
	resetSessionReplaceConfirmationStateForTests,
	resolveSessionReplaceConfirmation,
	SESSION_REPLACE_CONFIRM_HEADER,
} from '../auth/ssoSessionReplaceConfirm';
import {
	showSessionExpiredRedirectToast,
	showSessionReplacedToast,
} from '../auth/sessionAuthToasts';
import {
	markSessionReplacedPending,
	resolveDefaultOidcRedirectUri,
} from '../../utils/authRedirect';
import { log } from '../../utils/logger';

export function isOpaqueDesktopOrigin(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return (
		window.location.protocol === 'fofline-spa:' ||
		window.location.protocol === 'tauri:' ||
		(window as Window & { __TAURI__?: unknown }).__TAURI__ !== undefined
	);
}

/** Resolve streaming fetch target; absolutize relative `/api/*` on opaque FoFline/Tauri origins. */
export function resolveApiFetchUrlString(input: RequestInfo | URL): string {
	const requestUrl =
		typeof input === 'string'
			? input
			: input instanceof URL
				? input.toString()
				: input.url;
	if (/^https?:\/\//i.test(requestUrl)) {
		return requestUrl.startsWith('http://')
			? `https://${requestUrl.slice('http://'.length)}`
			: requestUrl;
	}
	if (isOpaqueDesktopOrigin() && requestUrl.startsWith('/')) {
		return resolveAbsoluteApiBaseURL(requestUrl);
	}
	return requestUrl;
}

declare module 'axios' {
	export interface InternalAxiosRequestConfig {
		metadata?: {
			startTime: number;
			releaseAuthAbort?: () => void;
		};
		_retryAuth?: boolean;
		_retrySessionReplaceConfirm?: boolean;
		_retryCount?: number;
	}
}

export function isRequestAborted(error: unknown): boolean {
	if (axios.isCancel(error)) {
		return true;
	}
	const e = error as AxiosError & { code?: string; name?: string };
	return (
		e?.code === 'ERR_CANCELED' ||
		e?.name === 'CanceledError' ||
		e?.message === 'canceled'
	);
}

/**
 * Custom API Error
 * Extended error with additional context
 */
export class APIError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public errorCode?: string,
		public details?: unknown,
		public originalError?: AxiosError,
		public endpoint?: string
	) {
		super(message);
		this.name = 'APIError';
		Object.setPrototypeOf(this, APIError.prototype);
	}

	get isNetworkError(): boolean {
		return !this.statusCode || this.statusCode === 0;
	}

	get isServerError(): boolean {
		return !!this.statusCode && this.statusCode >= 500;
	}

	get isClientError(): boolean {
		return !!this.statusCode && this.statusCode >= 400 && this.statusCode < 500;
	}

	get isAuthError(): boolean {
		return this.statusCode === 401 || this.statusCode === 403;
	}
}

/**
 * Request/Response Types
 */
export interface APIResponse<T = unknown> {
	data: T;
	message?: string;
	success: boolean;
}

export function unwrapApiData<T>(payload: unknown): T {
	if (
		payload &&
		typeof payload === 'object' &&
		'data' in (payload as Record<string, unknown>) &&
		('success' in (payload as Record<string, unknown>) ||
			'message' in (payload as Record<string, unknown>))
	) {
		return (payload as APIResponse<T>).data;
	}
	return payload as T;
}

export interface PaginatedResponse<T = unknown> {
	items: T[];
	total: number;
	page: number;
	per_page: number;
	pages: number;
}

/**
 * Error Response Type
 */
export interface ErrorResponseData {
	detail?: string | AuthErrorBody | Record<string, unknown>;
	message?: string;
	code?: string;
	/**
	 * Production `http_exception_handler` (main.py) puts `HTTPException.detail` here for non-auth errors
	 * (string or object, e.g. 402 with `{ message, ew_balance, required, app_id }`).
	 */
	error?: string | Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * Unified auth error body from backend (api/core/auth_errors).
 * Used to decide login vs refresh and to preserve return URL.
 */
export interface AuthErrorBody {
	error?: string;
	reason?:
		| 'token_missing'
		| 'token_expired'
		| 'invalid_token'
		| 'forbidden'
		| 'session_replaced'
		| 'session_replace_confirmation_required'
		| 'authentication_failed'
		| 'sso_registry_unavailable'
		| 'fofline_remote_tools_denied';
	action?: 'login' | 'refresh' | 'retry';
	detail?: string;
	/** FoFline↔browser XOR winner when this client was displaced. */
	displaced_by?: string;
	/** FoFline↔browser XOR partner that would be displaced (confirm UX). */
	xor_partner?: string;
}

/** Normalize backend detail (string or FastAPI validation array) to a single string */
export function normalizeDetail(detail: unknown): string | undefined {
	if (detail == null) return undefined;
	if (typeof detail === 'string') return detail;
	if (Array.isArray(detail) && detail.length > 0) {
		const first = detail[0];
		if (first && typeof first === 'object' && 'msg' in first)
			return String((first as { msg?: string }).msg);
		return String(detail[0]);
	}
	if (typeof detail === 'object' && 'msg' in (detail as object))
		return String((detail as { msg?: string }).msg);
	if (
		typeof detail === 'object' &&
		detail !== null &&
		'message' in (detail as object)
	) {
		const m = (detail as { message?: unknown }).message;
		if (typeof m === 'string' && m.length > 0) return m;
	}
	return String(detail);
}

/**
 * Error Handler
 */
export const handleAPIError = (error: AxiosError, endpoint?: string): never => {
	const message = error.message || '';
	const isTimeoutError =
		error.code === 'ECONNABORTED' || /timeout/i.test(message);

	if (isTimeoutError) {
		throw new APIError(
			ErrorMessages.timeout,
			408,
			'TIMEOUT',
			undefined,
			error,
			endpoint
		);
	}

	if (error.response) {
		// Server responded with error status
		const { status, data } = error.response;
		const errorData = data as ErrorResponseData | undefined;
		const detailStr = normalizeDetail(errorData?.detail);
		const errorFromPayload =
			typeof errorData?.error === 'string'
				? errorData.error
				: normalizeDetail(errorData?.error);
		const fallback =
			status === 404
				? ErrorMessages.notFound
				: status === 413
					? 'Слишком большой файл или запрос (413). Если размер в пределах лимита приложения (до ~100 МБ на API), проверьте внешний nginx: нужен client_max_body_size не ниже 64–100M (шаблон: docker/host_conf/nginx-app-https.conf). Иначе уменьшите файл.'
					: status >= 500
						? ErrorMessages.serverError
						: ErrorMessages.unknown;
		const message =
			detailStr ||
			(errorFromPayload && errorFromPayload !== '[object Object]'
				? errorFromPayload
				: undefined) ||
			errorData?.message ||
			fallback;

		throw new APIError(message, status, errorData?.code, data, error, endpoint);
	} else if (error.request) {
		// Request made but no response
		throw new APIError(
			ErrorMessages.network,
			0,
			'NETWORK_ERROR',
			undefined,
			error,
			endpoint
		);
	} else {
		// Something else happened
		throw new APIError(
			error.message || ErrorMessages.unknown,
			undefined,
			'UNKNOWN_ERROR',
			undefined,
			error,
			endpoint
		);
	}
};

/**
 * Retry Logic
 *
 * PUT is treated as retryable for transient failures; if a non-idempotent PUT is added later,
 * exclude it (e.g. custom axios config) or retries may duplicate side effects.
 */
export const RETRYABLE_METHODS = new Set(['get', 'head', 'options', 'put']);

/**
 * True when API signals PostgreSQL schema drift (operators must apply migrations; immediate retry is pointless).
 */
export function isDbSchemaMigrationUnavailable(error: AxiosError): boolean {
	const data = error.response?.data;
	if (!data || typeof data !== 'object') return false;
	return (data as { reason?: string }).reason === 'db_schema_migration';
}

export const shouldRetry = (
	error: AxiosError,
	attemptNumber: number
): boolean => {
	if (isRequestAborted(error)) {
		return false;
	}

	if (getCurrentMaintenanceStatus().active) {
		return false;
	}

	if (attemptNumber >= API_CONFIG.retry.attempts) {
		return false;
	}

	const method = error.config?.method?.toLowerCase() || 'get';
	if (!RETRYABLE_METHODS.has(method)) {
		return false;
	}

	const message = error.message || '';
	const isNetworkChanged =
		/ERR_NETWORK_CHANGED/i.test(message) || /network.*changed/i.test(message);

	// Transparent retry on Chrome's "ERR_NETWORK_CHANGED" once, even if there is no response object yet
	if (isNetworkChanged) {
		return attemptNumber === 1;
	}

	// Retry on generic network errors without response (temporary connectivity issues)
	if (!error.response) {
		return true;
	}

	const status = error.response.status;

	// Deterministic operator action: no point duplicating GET noise in DevTools
	if (status === 503 && isDbSchemaMigrationUnavailable(error)) {
		return false;
	}

	// ✅ FIX: Для 500 ошибок retry только 1 раз (не 3), так как если сервер постоянно возвращает 500,
	// то retry бесполезен и только создает лишнюю нагрузку
	if (status >= 500 && status < 600) {
		// Retry только один раз для 500 ошибок
		return attemptNumber === 1;
	}

	// 408: transient; 429: do not retry blindly (no Retry-After handling — would worsen rate limits)
	const retryStatuses = [408];
	return retryStatuses.includes(status);
};

export const getRetryDelay = (attemptNumber: number): number => {
	return (
		API_CONFIG.retry.delay *
		API_CONFIG.retry.backoffFactor ** (attemptNumber - 1)
	);
};

/** Parse unified auth error body from 401/403 response (backend auth_errors). */
export function parseAuthErrorBody(data: unknown): AuthErrorBody | null {
	if (!data || typeof data !== 'object') return null;
	const d = data as Record<string, unknown>;
	const body = (
		d.detail && typeof d.detail === 'object'
			? d.detail
			: d.error && typeof d.error === 'object'
				? d.error
				: d
	) as Record<string, unknown>;
	if (body.reason && typeof body.reason === 'string') {
		const action =
			body.action === 'refresh'
				? 'refresh'
				: body.action === 'retry'
					? 'retry'
					: 'login';
		return {
			error: typeof body.error === 'string' ? body.error : 'unauthorized',
			reason: body.reason as AuthErrorBody['reason'],
			action,
			detail: typeof body.detail === 'string' ? body.detail : undefined,
			displaced_by:
				typeof body.displaced_by === 'string' ? body.displaced_by : undefined,
			xor_partner:
				typeof body.xor_partner === 'string' ? body.xor_partner : undefined,
		};
	}
	return null;
}

/**
 * FastAPI often returns `{ detail: "string_code" }` for product rules (not session state).
 * Those must not trigger redirect-to-login on 403.
 */
export function isForbiddenBusinessDetailString(data: unknown): boolean {
	if (!data || typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;
	const detail = d.detail;
	if (typeof detail !== 'string') return false;
	return (
		detail === 'marketing_cabinet_required_for_group_chat' ||
		detail.startsWith('solo_slot_') ||
		detail === 'insufficient_credits'
	);
}

export function isForbiddenAccessDeniedAuthPayload(data: unknown): boolean {
	const authBody = parseAuthErrorBody(data);
	return (
		authBody?.reason === 'forbidden' &&
		typeof authBody.detail === 'string' &&
		authBody.detail.includes('Access denied')
	);
}

/** Desktop AI Chat uses 403 for solo slot / business rules — never treat as "please log in". */
export function shouldSkip403AuthRedirect(
	url: string | undefined,
	data: unknown
): boolean {
	const authBody = parseAuthErrorBody(data);
	if (
		authBody?.reason === 'forbidden' &&
		(url?.includes('/api/v1/doc-editor/') || url?.includes('/api/v1/content/'))
	) {
		// Business permission checks (owner/editor rights), not an auth-session problem.
		return true;
	}
	if (url?.includes('/desktop/ai-chat')) {
		return true;
	}
	return (
		isForbiddenBusinessDetailString(data) ||
		isForbiddenAccessDeniedAuthPayload(data)
	);
}

export function releaseRequestAbortRegistration(
	config: InternalAxiosRequestConfig | undefined
): void {
	config?.metadata?.releaseAuthAbort?.();
}

/** Save current page for post-login return and redirect to login. */
export function saveIntendedPageAndLogout(): void {
	if (isAuthSessionLocked()) {
		return;
	}
	if (
		typeof window === 'undefined' ||
		window.location.pathname.includes('/login') ||
		window.location.pathname.includes('/auth')
	) {
		authSession.logout({
			redirectUri: resolveDefaultOidcRedirectUri(),
		});
		return;
	}
	const currentPage = getShellPageIdForIntendedStorage() ?? 'desktop';
	try {
		sessionStorage.setItem(INTENDED_PAGE_SESSION_KEY, currentPage);
	} catch {
		// ignore
	}
	log.warn('APIClient', 'Session expired, redirecting to login. Return page', {
		currentPage,
	});
	showSessionExpiredRedirectToast();
	authSession.logout({
		redirectUri: resolveDefaultOidcRedirectUri(),
	});
}

const SESSION_REPLACED_HANDLING_RESET_MS = 15_000;
let sessionReplacedHandlingInFlight = false;

export function handleSessionReplaced(displacedBy?: string | null): void {
	if (isAuthSessionLocked() || sessionReplacedHandlingInFlight) {
		return;
	}
	sessionReplacedHandlingInFlight = true;
	if (typeof window !== 'undefined') {
		window.setTimeout(() => {
			sessionReplacedHandlingInFlight = false;
		}, SESSION_REPLACED_HANDLING_RESET_MS);
	}
	clearSessionReplaceConfirmedWindow();
	if (typeof window === 'undefined') return;
	const currentPage = getShellPageIdForIntendedStorage() ?? 'desktop';
	try {
		sessionStorage.setItem(INTENDED_PAGE_SESSION_KEY, currentPage);
	} catch {
		// ignore
	}
	notifySessionReplaced('api_session_replaced');
	showSessionReplacedToast(displacedBy);
	markSessionReplacedPending();
}

export { resetSessionReplaceConfirmationStateForTests };

export function resetSessionReplacedHandlingStateForTests(): void {
	sessionReplacedHandlingInFlight = false;
}

export async function confirmSessionReplaceAndRetry(
	client: AxiosInstance,
	config: InternalAxiosRequestConfig
): Promise<AxiosResponse | null> {
	if (config._retrySessionReplaceConfirm) {
		return null;
	}
	const confirmed = await resolveSessionReplaceConfirmation();
	if (!confirmed) {
		return null;
	}
	config._retrySessionReplaceConfirm = true;
	config.headers = config.headers ?? {};
	(config.headers as Record<string, string>)[SESSION_REPLACE_CONFIRM_HEADER] =
		'1';
	if (authSession.token) {
		config.headers.Authorization = `Bearer ${authSession.token}`;
	}
	return client.request(config);
}
