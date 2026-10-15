/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Leader-tab Socket.IO connect lifecycle gated on desktop shell ready.
 *
 * Invariants:
 * - Connect only when userId + isSocketOwner; disconnect deferred via rAF.
 * - Shell bootstrap: subscribeDesktopShellReady before first connect attempt.
 * - On `presence_superseded` yield (newest-wins); do not immediately reclaim the lease.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - utils/desktopShellReady.ts
 * - hooks/useSocketConnection.tsx (desktop defers to this provider)
 */
import { setBrowserTabSocketConnected } from '@/utils/browserTabLeaderState';
import { setSocketConnectionConnected } from '@/services/communication/socketConnectionStore';
import { Services } from '@/services';
import { useEffect } from 'react';
import {
	getDesktopShellReady,
	subscribeDesktopShellReady,
} from '../utils/desktopShellReady';
import { subscribeDocumentVisibleSync } from '../utils/subscribeDocumentVisibleSync';
import {
	SOCKET_LEASE_RETRY_MS,
	SOCKET_RECONNECT_PROBE_MS,
	SOCKET_SYNC_INTERVAL_MS,
} from './gafChatProviderTypes';

export function useDesktopSocketLeaderDisconnectEffects(options: {
	userId: string | undefined;
	isSocketOwner: boolean;
}) {
	const { userId, isSocketOwner } = options;

	useEffect(() => {
		return () => {
			requestAnimationFrame(() => {
				try {
					void Services.socket.disconnect();
				} catch {
					/* ignore */
				}
			});
		};
	}, []);

	useEffect(() => {
		if (userId && isSocketOwner) {
			return;
		}
		setSocketConnectionConnected(false);
		setBrowserTabSocketConnected(false);
		const frame = requestAnimationFrame(() => {
			try {
				void Services.socket.disconnect();
			} catch {
				/* ignore */
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [userId, isSocketOwner]);
}

export function useDesktopSocketLeaderConnect(options: {
	userId: string | undefined;
	isSocketOwner: boolean;
	socketDisplayName: string;
}) {
	const { userId, isSocketOwner, socketDisplayName } = options;

	useEffect(() => {
		if (!userId || !isSocketOwner) {
			return;
		}
		const socket = Services.socket;
		if (!socket || typeof socket.connect !== 'function') return;

		let cancelled = false;
		let reconnectTimer: number | null = null;
		/** After server newest-wins supersede, do not immediately fight for the lease. */
		let yieldAfterSupersede = false;

		const connectParams = {
			user_id: userId,
			user_name: socketDisplayName,
			capabilities: ['chat', 'monitoring'] as string[],
		};

		const syncConnected = () => {
			if (cancelled) return;
			try {
				if (typeof socket.isConnected === 'function') {
					const ok = socket.isConnected();
					setSocketConnectionConnected(ok);
					setBrowserTabSocketConnected(ok);
				}
			} catch {
				setSocketConnectionConnected(false);
				setBrowserTabSocketConnected(false);
			}
		};

		const attemptConnect = () => {
			if (cancelled) return;
			yieldAfterSupersede = false;
			try {
				if (typeof socket.getConnectionState === 'function') {
					const state = socket.getConnectionState();
					if (state === 'connecting') {
						return;
					}
					if (state === 'connected' && socket.isConnected?.()) {
						syncConnected();
						return;
					}
				}
			} catch {
				/* ignore state probe errors */
			}
			void socket
				.connect(connectParams)
				.then(() => {
					if (!cancelled) syncConnected();
				})
				.catch(() => {
					if (!cancelled) setSocketConnectionConnected(false);
				});
		};

		const scheduleReconnect = (delayMs = SOCKET_LEASE_RETRY_MS) => {
			if (cancelled || reconnectTimer != null || yieldAfterSupersede) return;
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = null;
				attemptConnect();
			}, delayMs);
		};

		let disposeConnect: (() => void) | null = null;
		let shellRaf: number | null = null;

		const activateSocketTransport = () => {
			if (cancelled) return;

			attemptConnect();

			const unsubLost =
				typeof socket.addEventListener === 'function'
					? socket.addEventListener('connection-lost', () => {
							setSocketConnectionConnected(false);
							setBrowserTabSocketConnected(false);
							scheduleReconnect();
						})
					: () => {};

			const intervalId = window.setInterval(
				syncConnected,
				SOCKET_SYNC_INTERVAL_MS
			);
			const reconnectProbeId = window.setInterval(() => {
				if (cancelled) return;
				try {
					if (
						typeof socket.isConnected === 'function' &&
						!socket.isConnected()
					) {
						attemptConnect();
					}
				} catch {
					scheduleReconnect();
				}
			}, SOCKET_RECONNECT_PROBE_MS);

			const unsubVisibleSync = subscribeDocumentVisibleSync(() => {
				syncConnected();
				try {
					if (
						typeof socket.isConnected === 'function' &&
						!socket.isConnected()
					) {
						attemptConnect();
					}
				} catch {
					scheduleReconnect();
				}
			});

			disposeConnect = () => {
				unsubLost();
				unsubVisibleSync();
				window.clearInterval(intervalId);
				window.clearInterval(reconnectProbeId);
			};
		};

		const scheduleActivate = () => {
			shellRaf = window.requestAnimationFrame(() => {
				activateSocketTransport();
			});
		};

		const unsubSuperseded =
			typeof socket.addEventListener === 'function'
				? socket.addEventListener('presence_superseded', () => {
						setSocketConnectionConnected(false);
						setBrowserTabSocketConnected(false);
						// Newest-wins lease: this sid lost. Yield — probe/visibility reclaim later.
						yieldAfterSupersede = true;
						if (reconnectTimer != null) {
							window.clearTimeout(reconnectTimer);
							reconnectTimer = null;
						}
						try {
							void socket.disconnect();
						} catch {
							/* ignore */
						}
					})
				: () => {};

		const unsubRestored =
			typeof socket.addEventListener === 'function'
				? socket.addEventListener('connection-restored', () => {
						syncConnected();
					})
				: () => {};

		let unsubShellReady: (() => void) | null = null;
		if (getDesktopShellReady()) {
			scheduleActivate();
		} else {
			unsubShellReady = subscribeDesktopShellReady(scheduleActivate);
		}

		return () => {
			cancelled = true;
			if (shellRaf != null) {
				window.cancelAnimationFrame(shellRaf);
			}
			unsubShellReady?.();
			disposeConnect?.();
			if (reconnectTimer != null) {
				window.clearTimeout(reconnectTimer);
			}
			unsubSuperseded();
			unsubRestored();
		};
	}, [userId, isSocketOwner, socketDisplayName]);
}
