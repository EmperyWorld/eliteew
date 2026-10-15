/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure classifier for browser OIDC refresh outcomes (Continuity W0).
 * Maps Keycloak/oauth4webapi failures to redacted continuity results without
 * reading or emitting bearer tokens.
 *
 * Invariants:
 * - Never accepts or returns access/refresh/id tokens or authorization codes.
 * - Does not infer SSO max/idle policy from a failed refresh (policy is separate).
 *
 * Related:
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W0
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md`
 * - `keycloakOidcRefreshFlow.ts`
 */

export type WebSsoRefreshResultKind =
	| 'refreshed'
	| 'idle_or_max_expired'
	| 'session_replaced'
	| 'reuse_detected'
	| 'network';

export type WebSsoRefreshPhase = 'start' | 'result';

export interface WebSsoRefreshContinuityEvent {
	phase: WebSsoRefreshPhase;
	correlationId: string;
	kind?: WebSsoRefreshResultKind;
	/** OAuth `error` code when present (e.g. invalid_grant) — never a token. */
	oauthError?: string;
	/** Truncated Keycloak/oauth `error_description` — never a token. */
	oauthErrorDescription?: string;
	httpStatus?: number;
}

export interface ClassifyWebSsoRefreshFailureInput {
	error: unknown;
	httpStatus?: number;
}

const MAX_DESCRIPTION_CHARS = 160;

export function newWebSsoRefreshCorrelationId(): string {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID();
	}
	return `wssr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === 'object') {
		return value as Record<string, unknown>;
	}
	return null;
}

function readStringField(
	record: Record<string, unknown> | null,
	key: string
): string | undefined {
	const value = record?.[key];
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function truncateDescription(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const compact = value.replace(/\s+/g, ' ').trim();
	if (!compact) return undefined;
	return compact.length > MAX_DESCRIPTION_CHARS
		? `${compact.slice(0, MAX_DESCRIPTION_CHARS)}…`
		: compact;
}

/**
 * Extract redacted OAuth failure fields from oauth4webapi ResponseBodyError,
 * nested cause, Response, or plain Error.message.
 */
export function extractWebSsoRefreshFailureHints(error: unknown): {
	oauthError?: string;
	oauthErrorDescription?: string;
	httpStatus?: number;
	message: string;
} {
	const record = asRecord(error);
	const cause = asRecord(record?.cause);
	const oauthError =
		readStringField(record, 'error') ?? readStringField(cause, 'error');
	const oauthErrorDescription = truncateDescription(
		readStringField(record, 'error_description') ??
			readStringField(cause, 'error_description')
	);
	const statusRaw = record?.status ?? cause?.status;
	const httpStatus =
		typeof statusRaw === 'number' && Number.isFinite(statusRaw)
			? statusRaw
			: undefined;
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: String(error ?? '');
	return {
		oauthError,
		oauthErrorDescription,
		httpStatus,
		message,
	};
}

function haystackFromFailure(input: ClassifyWebSsoRefreshFailureInput): {
	text: string;
	oauthError?: string;
	oauthErrorDescription?: string;
	httpStatus?: number;
} {
	const hints = extractWebSsoRefreshFailureHints(input.error);
	const httpStatus = input.httpStatus ?? hints.httpStatus;
	const text = [hints.oauthError, hints.oauthErrorDescription, hints.message]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	return {
		text,
		oauthError: hints.oauthError,
		oauthErrorDescription: hints.oauthErrorDescription,
		httpStatus,
	};
}

function isNetworkFailure(
	text: string,
	httpStatus: number | undefined
): boolean {
	if (httpStatus === 0) return true;
	if (
		/failed to fetch|networkerror|net::|load failed|econnreset|etimedout|aborterror|the operation was aborted|network request failed/.test(
			text
		)
	) {
		return true;
	}
	// oauth4webapi / fetch TypeError without OAuth body
	if (!text.includes('invalid_') && /typeerror/.test(text)) {
		return true;
	}
	return false;
}

/**
 * Classify a failed browser refresh into Continuity W0 kinds.
 * Prefer Keycloak descriptions over bare HTTP status.
 */
export function classifyWebSsoRefreshFailure(
	input: ClassifyWebSsoRefreshFailureInput
): {
	kind: WebSsoRefreshResultKind;
	oauthError?: string;
	oauthErrorDescription?: string;
	httpStatus?: number;
} {
	const { text, oauthError, oauthErrorDescription, httpStatus } =
		haystackFromFailure(input);

	if (
		/session_replaced|session was replaced by a newer login|replaced by a newer/.test(
			text
		)
	) {
		return {
			kind: 'session_replaced',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	if (
		/maximum allowed refresh token reuse|refresh token max reuse|token reuse|stale refresh|refresh token already used/.test(
			text
		)
	) {
		return {
			kind: 'reuse_detected',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	// Keycloak: expired SSO idle/max → invalid_grant + "Session not active"
	if (
		/session not active|user session not found|offline user session not found|client session not found/.test(
			text
		)
	) {
		return {
			kind: 'idle_or_max_expired',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	// Rotated refresh under reuse=0 often surfaces as invalid_grant + Token is not active
	if (
		/token is not active|invalid refresh token|refresh token is invalid|refresh token expired/.test(
			text
		)
	) {
		return {
			kind: 'reuse_detected',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	if (isNetworkFailure(text, httpStatus)) {
		return {
			kind: 'network',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	// Transient IdP / edge 5xx and timeouts without OAuth body
	if (httpStatus !== undefined && (httpStatus >= 500 || httpStatus === 408)) {
		return {
			kind: 'network',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	// Remaining invalid_grant without a specific description: treat as terminal
	// SSO/token family death, not a transient network blip.
	if (
		oauthError === 'invalid_grant' ||
		oauthError === 'invalid_token' ||
		/invalid_grant|invalid_token/.test(text)
	) {
		return {
			kind: 'idle_or_max_expired',
			oauthError,
			oauthErrorDescription,
			httpStatus,
		};
	}

	return {
		kind: 'network',
		oauthError,
		oauthErrorDescription,
		httpStatus,
	};
}

export function buildWebSsoRefreshStartEvent(
	correlationId: string
): WebSsoRefreshContinuityEvent {
	return {
		phase: 'start',
		correlationId,
	};
}

export function buildWebSsoRefreshSuccessEvent(
	correlationId: string
): WebSsoRefreshContinuityEvent {
	return {
		phase: 'result',
		correlationId,
		kind: 'refreshed',
	};
}

export function buildWebSsoRefreshFailureEvent(
	correlationId: string,
	input: ClassifyWebSsoRefreshFailureInput
): WebSsoRefreshContinuityEvent {
	const classified = classifyWebSsoRefreshFailure(input);
	return {
		phase: 'result',
		correlationId,
		kind: classified.kind,
		oauthError: classified.oauthError,
		oauthErrorDescription: classified.oauthErrorDescription,
		httpStatus: classified.httpStatus,
	};
}
