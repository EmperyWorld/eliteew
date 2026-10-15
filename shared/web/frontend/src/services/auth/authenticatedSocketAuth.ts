/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Socket.IO auth payload patching, connect_error parsing, and refresh/reconnect recovery.
 *
 * Invariants:
 * - Never log tokens; patch `socket.io.opts.auth` before reconnect after refresh or SSO confirm.
 * - On OIDC access-token refresh while connected: **patch auth only** — never
 *   `disconnect()+connect()` (that forced newest-wins lease takeover ~every token TTL).
 * - Interactive login only after refresh recovery fails.
 *
 * Related:
 * - services/auth/ssoSessionReplaceConfirm.ts, hooks/useSocketConnection.tsx
 * - services/communication/EmperyworldSocketService.ts, services/auth/socketIoClientPolicy.ts
 */

import type { Socket } from 'socket.io-client';
import { getAppBuildId } from '../../utils/appBuildId';
import { beginInteractiveLogin } from '../../utils/authRedirect';
import authSession, { getToken } from '../authSession';
import { subscribeAuthRefreshSuccess } from '../keycloak';
import { isAuthSessionLocked } from './authSessionLock';
import {
	confirmSessionReplaceForSocket,
	getSocketSsoReplaceConfirmFlag,
} from './ssoSessionReplaceConfirm';

export type SocketAuthPayload = Record<string, unknown> & {
	token: string;
	app_build?: string;
	sso_replace_confirm?: 1;
};

export type ParsedSocketConnectError = {
	reason: string | null;
	isAuthFailure: boolean;
	isSessionReplaceConfirmationRequired: boolean;
	isStaleClient: boolean;
	isStaleEngineSession: boolean;
	isSingleBrowserRealtimeConflict: boolean;
};

function socketConnectErrorStatus(error: unknown): number | null {
	const err = error as { description?: unknown; message?: string };
	if (typeof err.description === 'number' && err.description >= 100) {
		return err.description;
	}
	if (typeof err.description === 'string') {
		const match = err.description.match(/\b(\d{3})\b/);
		if (match) {
			return Number.parseInt(match[1], 10);
		}
	}
	const combined = `${err.message ?? ''} ${String(err.description ?? '')}`;
	const match = combined.match(/\b(\d{3})\b/);
	return match ? Number.parseInt(match[1], 10) : null;
}

function extractRejectReason(error: unknown): string | null {
	const err = error as {
		message?: string;
		description?: string;
		data?: unknown;
	};
	if (err.data && typeof err.data === 'object' && err.data !== null) {
		const reason = (err.data as { reason?: unknown }).reason;
		if (typeof reason === 'string' && reason.trim()) {
			return reason.trim();
		}
	}
	const combined = `${err.message ?? ''} ${err.description ?? ''}`.trim();
	const match = combined.match(/reason[=:"'\s]+([a-z0-9_]+)/i);
	return match?.[1]?.toLowerCase() ?? null;
}

export function parseSocketConnectError(
	error: unknown
): ParsedSocketConnectError {
	const err = error as { message?: string; description?: string };
	const msg = err?.message ?? '';
	const desc = err?.description ?? '';
	const combined = `${msg} ${desc}`.toLowerCase();
	const reason = extractRejectReason(error);
	const isSessionReplaceConfirmationRequired =
		reason === 'session_replace_confirmation_required' ||
		combined.includes('session_replace_confirmation_required');
	const staleClientReasons = new Set([
		'client_stale',
		'missing_app_build',
		'app_build_mismatch',
	]);
	const descText = typeof desc === 'string' ? desc : String(desc ?? '');
	const normalizedStaleReason =
		reason ??
		(/^(client_stale|missing_app_build|app_build_mismatch)$/i.test(msg.trim())
			? msg.trim().toLowerCase()
			: /^(client_stale|missing_app_build|app_build_mismatch)$/i.test(
						descText.trim()
					)
				? descText.trim().toLowerCase()
				: null);
	const isStaleClient =
		normalizedStaleReason != null &&
		staleClientReasons.has(normalizedStaleReason);
	const status = socketConnectErrorStatus(error);
	const isStaleEngineSession =
		status === 400 ||
		(/\b400\b/.test(combined) &&
			/poll|websocket|transport|handshake|xhr/i.test(combined));
	const isSingleBrowserRealtimeConflict =
		reason === 'single_browser_realtime' ||
		combined.includes('single_browser_realtime');
	const isAuthFailure =
		isSessionReplaceConfirmationRequired ||
		reason === 'token_expired' ||
		reason === 'invalid_token' ||
		reason === 'session_replaced' ||
		reason === 'sso_registry_unavailable' ||
		reason === 'token_missing' ||
		/unauthorized|401|auth:/i.test(combined);
	return {
		reason,
		isAuthFailure,
		isSessionReplaceConfirmationRequired,
		isStaleClient,
		isStaleEngineSession,
		isSingleBrowserRealtimeConflict,
	};
}

export function buildSocketAuthPayload(
	token: string,
	extra?: Record<string, unknown>
): SocketAuthPayload {
	const confirm = getSocketSsoReplaceConfirmFlag();
	return {
		...extra,
		token,
		app_build: getAppBuildId(),
		...(confirm ? { sso_replace_confirm: confirm } : {}),
	};
}

export function patchSocketAuth(
	socket: Socket | null | undefined,
	token?: string | null
): void {
	if (!socket?.io?.opts) return;
	const nextToken = (token ?? getToken() ?? '').trim();
	if (!nextToken) return;
	const ioOpts = socket.io.opts as typeof socket.io.opts & {
		auth?: Record<string, unknown>;
	};
	const prev = (ioOpts.auth ?? {}) as Record<string, unknown>;
	ioOpts.auth = buildSocketAuthPayload(nextToken, prev);
}

export async function recoverSocketAuthConnection(options: {
	reconnect: () => void;
	onBeforeReconnect?: () => void;
}): Promise<void> {
	if (isAuthSessionLocked()) {
		return;
	}
	const refreshed = await authSession
		.updateToken(Number.MAX_SAFE_INTEGER)
		.catch(() => false);
	if (refreshed && getToken()) {
		options.onBeforeReconnect?.();
		options.reconnect();
		return;
	}
	if (authSession.authenticated) {
		beginInteractiveLogin('socket_auth');
	}
}

export async function handleSocketConnectAuthError(
	error: unknown,
	options: {
		reconnect: () => void;
		patchAuth?: (token: string) => void;
	}
): Promise<'handled' | 'ignored'> {
	const parsed = parseSocketConnectError(error);
	if (parsed.isStaleClient) {
		return 'ignored';
	}
	if (parsed.isSessionReplaceConfirmationRequired) {
		const confirmed = await confirmSessionReplaceForSocket();
		if (confirmed) {
			const token = getToken();
			if (token) {
				options.patchAuth?.(token);
				options.reconnect();
			}
		}
		return 'handled';
	}
	if (parsed.isAuthFailure) {
		await recoverSocketAuthConnection(options);
		return 'handled';
	}
	return 'ignored';
}

export function bindSocketAuthRefresh(
	getSocket: () => Socket | null
): () => void {
	return subscribeAuthRefreshSuccess(() => {
		if (isAuthSessionLocked()) {
			return;
		}
		const socket = getSocket();
		// Live Engine.IO session keeps working; next reconnect/handshake reads patched auth.
		// Re-handshake here caused metronomic presence:takeover + Desktop refetch storms.
		patchSocketAuth(socket);
	});
}
