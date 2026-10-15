/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Socket.IO client transport policy and self-healing reconnect rules for all SPA entry points.
 *
 * Invariants:
 * - Every production Socket.IO client uses `ELITEEW_SOCKET_IO_TRANSPORTS` (websocket first, polling fallback).
 * - Same-sid Engine.IO reconnect after transport loss; `forceNew` only for stale Engine.IO 400.
 *   Server browser lease is **newest-wins** (`force_claim` + supersede); avoid racing with
 *   unnecessary `forceNew` on ordinary transport close.
 *
 * Related:
 * - hooks/useSocketConnection.tsx, services/communication/EmperyworldSocketService.ts
 * - components/UltimateDocEditor/hooks/useCollaboration.ts, services/auth/authenticatedSocketAuth.ts
 */

import type { Socket } from 'socket.io-client';

import type { ParsedSocketConnectError } from './authenticatedSocketAuth';

export const ELITEEW_SOCKET_IO_PATH = '/socket.io/' as const;

/** Canonical transport order — websocket first, polling fallback. */
export const ELITEEW_SOCKET_IO_TRANSPORTS = ['websocket', 'polling'] as const;

export type EliteewSocketIoTransport =
	(typeof ELITEEW_SOCKET_IO_TRANSPORTS)[number];

export function eliteewSocketIoTransportOptions(): {
	path: typeof ELITEEW_SOCKET_IO_PATH;
	transports: EliteewSocketIoTransport[];
} {
	return {
		path: ELITEEW_SOCKET_IO_PATH,
		transports: [...ELITEEW_SOCKET_IO_TRANSPORTS],
	};
}

/**
 * Transport-loss disconnects must reuse the Engine.IO sid.
 * Immediate `forceNew` on every transport loss is unnecessary: the API uses newest-wins
 * browser lease takeover. Prefer same-sid reconnect; use `forceNew` only after stale
 * Engine.IO HTTP 400 (`planForceNewReconnectAfterConnectError`).
 */
export function shouldForceNewOnTransportDisconnect(_reason: string): boolean {
	return false;
}

export function shouldForceNewOnConnectError(
	parsed: ParsedSocketConnectError
): boolean {
	return parsed.isStaleEngineSession;
}

export function disableSocketIoAutoReconnect(
	socket: Socket | null | undefined
): void {
	if (socket?.io?.opts) {
		socket.io.opts.reconnection = false;
	}
}

export type ForceNewReconnectPlan = {
	forceNew: boolean;
	reason: 'transport_disconnect' | 'stale_engine_session';
};

export function planForceNewReconnectAfterTransportDisconnect(
	reason: string
): ForceNewReconnectPlan | null {
	if (!shouldForceNewOnTransportDisconnect(reason)) {
		return null;
	}
	return { forceNew: true, reason: 'transport_disconnect' };
}

export function planForceNewReconnectAfterConnectError(
	parsed: ParsedSocketConnectError
): ForceNewReconnectPlan | null {
	if (!shouldForceNewOnConnectError(parsed)) {
		return null;
	}
	return { forceNew: true, reason: 'stale_engine_session' };
}
