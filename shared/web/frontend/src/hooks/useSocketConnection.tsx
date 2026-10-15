/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React-хук Socket.IO подключения к EliteEW API: создаёт handshake с актуальным JWT и восстанавливает
 * соединение после refresh token, planned maintenance и только потом запускает интерактивный login.
 *
 * Invariants:
 * - On desktop page, GAFChatProvider owns Socket.IO via Services.socket; App hook stays disconnected there.
 * - Non-desktop routes (admin и др.): один leader-tab на пользователя (`desktopRealtimeLeader`), не N вкладок.
 * - Auth failures не должны напрямую плодить login redirects: только через `beginInteractiveLogin`.
 *
 * Related:
 * - `services/authSession.ts`, `utils/authRedirect.ts`, `App.tsx`, `pages/Desktop/utils/desktopRealtimeLeader.ts`
 * - `services/maintenance/maintenanceState.ts`
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useBrowserTabLeader } from '@/contexts/BrowserTabLeaderProvider';
import { setBrowserTabSocketConnected } from '@/utils/browserTabLeaderState';
import {
	bundleMatchesServerBuild,
	reloadAllAppTabs,
} from '../utils/staleBundleReload';
import { getToken } from '../services/authSession';
import {
	bindSocketAuthRefresh,
	buildSocketAuthPayload,
	handleSocketConnectAuthError,
	parseSocketConnectError,
	patchSocketAuth,
} from '../services/auth/authenticatedSocketAuth';
import {
	disableSocketIoAutoReconnect,
	eliteewSocketIoTransportOptions,
	shouldForceNewOnTransportDisconnect,
} from '../services/auth/socketIoClientPolicy';
import { registerAuthSessionSocketTeardown } from '../services/auth/authSessionSocketTeardown';
import {
	isMaintenanceGatePhase,
	publishMaintenanceStatus,
} from '../services/maintenance/maintenanceState';
import { log } from '../utils/logger';
import { resolveSocketIoHttpOrigin } from '../services/api/config';

const LOG = 'useSocketConnection';

// ============= TYPE DEFINITIONS =============

interface SocketState {
	connected: boolean;
	error: string | null;
	reconnectAttempts: number;
}

interface SocketMessage {
	type: string;
	data: unknown;
}

// ============= CUSTOM HOOK =============

export function useSocketConnection(
	onConnectionChange?: (connected: boolean) => void,
	onMessage?: (event: string, data: unknown) => void,
	options?: {
		autoConnect?: boolean;
	}
) {
	const { autoConnect = false } = options || {};
	const { isSocketOwner, yieldLeadership } = useBrowserTabLeader();
	const socketRef = useRef<Socket | null>(null);
	const authRecoveryInFlightRef = useRef(false);
	const forceNewOnNextConnectRef = useRef(false);
	const transportRecoveryInFlightRef = useRef(false);
	const authRefreshUnsubRef = useRef<(() => void) | null>(null);
	const onConnectionChangeRef = useRef<typeof onConnectionChange>(undefined);
	const onMessageRef = useRef<typeof onMessage>(undefined);
	const [state, setState] = useState<SocketState>({
		connected: false,
		error: null,
		reconnectAttempts: 0,
	});

	onConnectionChangeRef.current = onConnectionChange;
	onMessageRef.current = onMessage;

	const resetDisconnectedState = useCallback(() => {
		setState((prev) => {
			if (
				!prev.connected &&
				prev.error === null &&
				prev.reconnectAttempts === 0
			) {
				return prev;
			}
			return {
				connected: false,
				error: null,
				reconnectAttempts: 0,
			};
		});
	}, []);

	// Connect to Socket.IO server
	const connect = useCallback(() => {
		if (socketRef.current?.connected) {
			if (import.meta.env.DEV) {
				log.info(LOG, 'Socket.IO already connected');
			}
			return;
		}
		// Do not reuse a stale Manager: `auth` is fixed at `io()` time; reconnecting
		// after a no-token attempt would still send an empty handshake.
		if (socketRef.current) {
			socketRef.current.removeAllListeners();
			socketRef.current.disconnect();
			socketRef.current = null;
		}

		const token = getToken();
		if (!token) {
			if (import.meta.env.DEV) {
				log.warn(
					LOG,
					'Socket.IO connect skipped: no access token (wait for auth)'
				);
			}
			return;
		}

		try {
			// Engine.IO origin: browser stays same-origin; opaque fofline-spa: is
			// https://app.eliteew.ru. Never pass window.location.origin through here.
			const socketUrl = resolveSocketIoHttpOrigin();

			const forceNew = forceNewOnNextConnectRef.current;
			forceNewOnNextConnectRef.current = false;

			if (import.meta.env.DEV) {
				log.info(LOG, 'Connecting to Socket.IO', { socketUrl, forceNew });
			}

			// Socket.IO configuration:
			// - prefer WebSocket for stable real-time channel,
			// - keep polling as fallback for restrictive networks/proxies.
			const socket = io(socketUrl, {
				...eliteewSocketIoTransportOptions(),
				reconnection: true,
				reconnectionDelay: 1000,
				reconnectionDelayMax: 15000,
				randomizationFactor: 0.5,
				reconnectionAttempts: 10,
				timeout: 20000,
				withCredentials: true,
				autoConnect: false, // manual connect keeps initial page load predictable
				upgrade: true,
				forceNew,
				auth: buildSocketAuthPayload(token),
			});

			// Connection handlers
			socket.on('connect', () => {
				setBrowserTabSocketConnected(true);
				if (import.meta.env.DEV) {
					log.info(LOG, 'Socket.IO connected', { socketId: socket.id });
				}
				setState({
					connected: true,
					error: null,
					reconnectAttempts: 0,
				});
				onConnectionChangeRef.current?.(true);
			});

			socket.on('disconnect', (reason: Socket.DisconnectReason) => {
				setBrowserTabSocketConnected(false);
				if (import.meta.env.DEV) {
					log.info(LOG, 'Socket.IO disconnected', { reason });
				}
				setState((prev) => ({
					...prev,
					connected: false,
				}));

				if (shouldForceNewOnTransportDisconnect(reason)) {
					if (transportRecoveryInFlightRef.current) {
						onConnectionChangeRef.current?.(false);
						return;
					}
					transportRecoveryInFlightRef.current = true;
					log.warn(
						LOG,
						'Socket.IO transport loss — reconnecting with forceNew',
						{ reason }
					);
					forceNewOnNextConnectRef.current = true;
					disableSocketIoAutoReconnect(socket);
					socket.removeAllListeners();
					socket.disconnect();
					socketRef.current = null;
					queueMicrotask(() => {
						connect();
						transportRecoveryInFlightRef.current = false;
					});
					return;
				}

				onConnectionChangeRef.current?.(false);
			});

			socket.on('connect_error', (error: Error) => {
				const parsed = parseSocketConnectError(error);
				if (parsed.isStaleEngineSession) {
					log.warn(
						LOG,
						'Socket.IO stale Engine.IO session (400) — reconnecting with forceNew'
					);
					disableSocketIoAutoReconnect(socket);
					socket.removeAllListeners();
					socket.disconnect();
					socketRef.current = null;
					forceNewOnNextConnectRef.current = true;
					connect();
					return;
				}
				if (parsed.isStaleClient) {
					if (socket.io?.opts) {
						socket.io.opts.reconnection = false;
					}
					reloadAllAppTabs('client_stale_connect_error');
					return;
				}
				if (parsed.isSessionReplaceConfirmationRequired) {
					log.warn(
						LOG,
						'Socket.IO auth requires explicit browser session replacement confirmation.'
					);
					setState((prev) => ({
						...prev,
						error: 'Session replacement confirmation required',
						reconnectAttempts: prev.reconnectAttempts + 1,
					}));
					if (authRecoveryInFlightRef.current) return;
					authRecoveryInFlightRef.current = true;
					void handleSocketConnectAuthError(error, {
						reconnect: connect,
						patchAuth: (nextToken) => patchSocketAuth(socket, nextToken),
					}).finally(() => {
						authRecoveryInFlightRef.current = false;
					});
					return;
				}
				if (parsed.isAuthFailure) {
					if (authRecoveryInFlightRef.current) return;
					authRecoveryInFlightRef.current = true;
					log.warn(
						LOG,
						'Socket.IO connection rejected (auth). Trying token refresh before login.'
					);
					socket.disconnect();
					socketRef.current = null;
					void handleSocketConnectAuthError(error, {
						reconnect: connect,
					}).finally(() => {
						authRecoveryInFlightRef.current = false;
					});
					return;
				}
				log.error(LOG, 'Socket.IO connection error', error, {
					message: error.message,
				});
				setState((prev) => ({
					...prev,
					error: error.message,
					reconnectAttempts: prev.reconnectAttempts + 1,
				}));
			});

			socket.on('auth_error', (data: unknown) => {
				let reason: string | null = null;
				if (
					data &&
					typeof data === 'object' &&
					data !== null &&
					'reason' in data
				) {
					const raw = (data as { reason?: unknown }).reason;
					if (typeof raw === 'string' && raw.trim()) {
						reason = raw.trim();
					}
				}
				log.warn(LOG, 'Socket.IO auth_error — recovering session', { reason });
				if (authRecoveryInFlightRef.current) return;
				authRecoveryInFlightRef.current = true;
				socket.disconnect();
				void handleSocketConnectAuthError(
					{
						message: reason ? `auth:${reason}` : 'auth:session_replaced',
						data:
							typeof data === 'object' && data !== null
								? data
								: { reason: reason ?? 'session_replaced' },
					},
					{
						reconnect: connect,
						patchAuth: (nextToken) => patchSocketAuth(socket, nextToken),
					}
				).finally(() => {
					authRecoveryInFlightRef.current = false;
				});
			});

			socket.on('reconnect_attempt', (attemptNumber: number) => {
				if (import.meta.env.DEV) {
					log.info(LOG, `Reconnection attempt ${attemptNumber}`);
				}
			});

			socket.on('reconnect', (attemptNumber: number) => {
				if (import.meta.env.DEV) {
					log.info(LOG, `Reconnected after ${attemptNumber} attempts`);
				}
				setState({
					connected: true,
					error: null,
					reconnectAttempts: 0,
				});
				onConnectionChangeRef.current?.(true);
			});

			socket.on('reconnect_failed', () => {
				log.error(LOG, 'Socket.IO reconnection failed after all attempts');
				setState((prev) => ({
					...prev,
					error: 'Reconnection failed after all retry attempts',
				}));
			});

			socket.on('connect_timeout', () => {
				log.error(LOG, 'Socket.IO connection timeout');
				setState((prev) => ({
					...prev,
					error: 'Connection timeout',
				}));
			});

			socket.onAny((event: string, ...args: unknown[]) => {
				const handler = onMessageRef.current;
				if (!handler) return;
				const data = args.length <= 1 ? args[0] : args;
				handler(event, data);
			});

			socket.on('presence_superseded', () => {
				log.info(LOG, 'presence_superseded — yielding realtime leadership');
				if (socket.io?.opts) {
					socket.io.opts.reconnection = false;
				}
				yieldLeadership();
				socket.disconnect();
			});

			socket.on('client_stale', (data: unknown) => {
				void (async () => {
					let serverBuild: string | null = null;
					if (data && typeof data === 'object' && data !== null) {
						const requiredBuild = (data as { required_build?: unknown })
							.required_build;
						if (typeof requiredBuild === 'string' && requiredBuild.trim()) {
							serverBuild = requiredBuild.trim();
						}
					}
					if (!serverBuild) {
						try {
							const response = await fetch(
								`/app-build-version.txt?t=${Date.now()}`,
								{ cache: 'no-store' }
							);
							if (response.ok) {
								const text = (await response.text()).trim();
								serverBuild = text || null;
							}
						} catch {
							/* ignore */
						}
					}
					if (serverBuild && bundleMatchesServerBuild(serverBuild)) {
						log.warn(
							LOG,
							'client_stale ignored — bundle matches server; reconnecting',
							{ serverBuild }
						);
						forceNewOnNextConnectRef.current = true;
						connect();
						return;
					}
					log.info(LOG, 'client_stale — reloading all tabs');
					if (socket.io?.opts) {
						socket.io.opts.reconnection = false;
					}
					socket.disconnect();
					reloadAllAppTabs('client_stale_socket');
				})();
			});

			socket.on('system.maintenance', (data: unknown) => {
				const status = publishMaintenanceStatus(data);
				if (isMaintenanceGatePhase(status) && socket.io?.opts) {
					socket.io.opts.reconnection = false;
				}
			});

			socket.on('presence_admin_command', (data: unknown) => {
				let action: string | undefined;
				if (
					data &&
					typeof data === 'object' &&
					data !== null &&
					'action' in data
				) {
					const v = (data as { action?: unknown }).action;
					action = typeof v === 'string' ? v : undefined;
				}
				if (action === 'reload') {
					reloadAllAppTabs('manual_user');
					return;
				}
				if (action === 'logout') {
					void import('../services/authSession')
						.then(({ logout }) => logout())
						.catch(() => {
							/* ignore */
						});
				}
			});

			socketRef.current = socket;
			authRefreshUnsubRef.current?.();
			authRefreshUnsubRef.current = bindSocketAuthRefresh(
				() => socketRef.current
			);
			socket.connect();
		} catch (error) {
			if (import.meta.env.DEV) {
				log.error(
					LOG,
					'Failed to create Socket.IO connection',
					error instanceof Error ? error : undefined,
					error
				);
			}
			setState((prev) => ({
				...prev,
				error: error instanceof Error ? error.message : 'Unknown error',
			}));
		}
	}, [yieldLeadership]);

	// Disconnect from Socket.IO server
	const disconnect = useCallback(() => {
		setBrowserTabSocketConnected(false);
		authRefreshUnsubRef.current?.();
		authRefreshUnsubRef.current = null;
		if (socketRef.current) {
			if (import.meta.env.DEV) {
				log.info(LOG, 'Disconnecting Socket.IO');
			}
			if (socketRef.current.io?.opts) {
				socketRef.current.io.opts.reconnection = false;
			}
			socketRef.current.removeAllListeners();
			socketRef.current.disconnect();
			socketRef.current = null;
		}

		resetDisconnectedState();
	}, [resetDisconnectedState]);

	// Emit event
	const emit = useCallback((event: string, data: unknown) => {
		if (socketRef.current?.connected) {
			socketRef.current.emit(event, data);
		} else {
			log.warn(LOG, 'Socket not connected, cannot emit', { event });
		}
	}, []);

	// Subscribe to event
	const on = useCallback((event: string, handler: (data: unknown) => void) => {
		socketRef.current?.on(event, handler);
	}, []);

	// Unsubscribe from event
	const off = useCallback(
		(event: string, handler?: (data: unknown) => void) => {
			socketRef.current?.off(event, handler);
		},
		[]
	);

	// Subscribe to all events
	const onAny = useCallback(
		(handler: (event: string, data: unknown) => void) => {
			socketRef.current?.onAny(handler);
		},
		[]
	);

	// Unsubscribe from all events
	const offAny = useCallback(
		(handler?: (event: string, data: unknown) => void) => {
			socketRef.current?.offAny(handler);
		},
		[]
	);

	// Connect only when this tab holds the shared browser socket mutex (admin / non-desktop).
	useEffect(() => {
		if (autoConnect && isSocketOwner) {
			connect();
		} else {
			disconnect();
		}

		return () => {
			if (autoConnect && isSocketOwner) {
				disconnect();
			}
		};
	}, [autoConnect, isSocketOwner, connect, disconnect]);

	useEffect(() => {
		return registerAuthSessionSocketTeardown(() => {
			disconnect();
		});
	}, [disconnect]);

	return {
		socket: socketRef.current,
		state,
		connect,
		disconnect,
		emit,
		on,
		off,
		onAny,
		offAny,
		isConnected: state.connected,
		isSocketOwner,
	};
}

export type { SocketState, SocketMessage };
