/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Provides Socket.IO collaboration wiring (presence, cursors, session events) for
 * Ultimate Doc Editor and coordinates teardown across reconnects/unmounts.
 *
 * Invariants:
 * - Unmount always clears cursor throttle timers and detaches socket listeners.
 * - Deferred Socket.IO disconnect RAF is tracked and canceled before scheduling a new teardown.
 * - Active doc session emits `leave_document` before disconnect when connection is alive.
 * - Follower browser tabs must not open a dedicated Socket.IO client (single-tab policy).
 * - Borrowed desktop socket re-joins on Services.socket `connection-restored` (no page refresh).
 *
 * Related:
 * - src/components/UltimateDocEditor/hooks/useYjsCollaboration.ts
 * - src/components/UltimateDocEditor/hooks/docEditorCollabSocketPolicy.ts
 * - src/components/UltimateDocEditor/store/editorStoreContext.ts
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useBrowserTabLeader } from '@/contexts/BrowserTabLeaderProvider';
import { isSingleTabPolicyEnabled } from '@/utils/browserTabLeaderState';
import {
	planDocEditorCollabSocket,
	type DocEditorCollabSocketPlan,
} from './docEditorCollabSocketPolicy';
import { shouldRejoinDocCollabOnSocketRestored } from './docEditorCollabSocketRecovery';
import {
	bindSocketAuthRefresh,
	buildSocketAuthPayload,
	handleSocketConnectAuthError,
	parseSocketConnectError,
	patchSocketAuth,
} from '../../../services/auth/authenticatedSocketAuth';
import {
	disableSocketIoAutoReconnect,
	eliteewSocketIoTransportOptions,
	shouldForceNewOnTransportDisconnect,
} from '../../../services/auth/socketIoClientPolicy';
import {
	useEditorStoreApi,
	useEditorStoreShallow,
} from '../store/editorStoreContext';
import { selectCollaborationSlice } from '../store/editorStoreSelectors';
import { getAuthToken } from '../../../utils/getAuthToken';
import { Services } from '../../../services';
import type {
	UseCollaborationReturn,
	CollaboratorInfo,
} from '../types/editor.types';
import { log } from '../../../utils/logger';

const SOCKET_URL = window.location.origin;
const CURSOR_THROTTLE_MS = 220;
const LEADER_SHARED_SOCKET_WAIT_MS = 5000;
const LEADER_SHARED_SOCKET_POLL_MS = 100;
/** After skip_leader_wait, retry join without forcing the user to refresh. */
const LEADER_WAIT_RETRY_MS = 2000;

function tryBorrowDesktopSocket(): Socket | null {
	try {
		const svc = Services.socket;
		if (!svc || typeof svc.getClientSocket !== 'function') {
			return null;
		}
		return svc.getClientSocket();
	} catch {
		return null;
	}
}

type SocketEventHandler = (...args: unknown[]) => void;

function bindTrackedHandlers(
	socket: Socket,
	entries: Array<[string, SocketEventHandler]>
): () => void {
	for (const [eventName, handler] of entries) {
		socket.on(eventName, handler);
	}
	return () => {
		for (const [eventName, handler] of entries) {
			socket.off(eventName, handler);
		}
	};
}

async function waitForBorrowableDesktopSocket(
	deadlineMs: number
): Promise<Socket | null> {
	const started = Date.now();
	while (Date.now() - started < deadlineMs) {
		const shared = tryBorrowDesktopSocket();
		// Wait until the desktop leader socket is actually connected — a disconnected
		// Manager instance is useless for join_document and caused sticky skip_leader_wait.
		if (shared?.connected) {
			return shared;
		}
		await new Promise((resolve) => {
			window.setTimeout(resolve, LEADER_SHARED_SOCKET_POLL_MS);
		});
	}
	return null;
}

function logCollabSocketPlan(plan: DocEditorCollabSocketPlan): void {
	if (plan === 'borrow') {
		return;
	}
	log.debug('useCollaboration', 'Doc collab Socket.IO plan', { plan });
}

export interface UseCollaborationOptions {
	/** Хозяин вышел — сессия завершена для всех */
	onDocEditorSessionEnded?: () => void;
	/** Владелец отключил вас от сессии */
	onKickedFromDocument?: () => void;
}

/**
 * Hook for real-time collaboration
 */
export const useCollaboration = (
	options?: UseCollaborationOptions
): UseCollaborationReturn => {
	const editorStoreApi = useEditorStoreApi();
	const { isSocketOwner } = useBrowserTabLeader();
	const socketRef = useRef<Socket | null>(null);
	const borrowedSharedSocketRef = useRef(false);
	const sessionUnbindRef = useRef<(() => void) | null>(null);
	const activeDocIdRef = useRef<string | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [mySocketId, setMySocketId] = useState<string | null>(null);
	const lastCursorRef = useRef<{ line: number; column: number } | null>(null);
	const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const disconnectRafRef = useRef<number | null>(null);
	const authRefreshUnsubRef = useRef<(() => void) | null>(null);
	const forceNewOnNextConnectRef = useRef(false);
	const lastJoinRef = useRef<{
		documentId: string;
		ownerUserId?: string;
	} | null>(null);
	const { activeCollaborators } = useEditorStoreShallow(
		selectCollaborationSlice
	);
	const leaveRef = useRef<() => Promise<void>>(async () => {});
	const joinRef = useRef<
		(documentId: string, joinOpts?: { ownerUserId?: string }) => Promise<void>
	>(async () => {});
	const leaderWaitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);
	const onSessionEndedRef = useRef(options?.onDocEditorSessionEnded);
	const onKickedRef = useRef(options?.onKickedFromDocument);
	onSessionEndedRef.current = options?.onDocEditorSessionEnded;
	onKickedRef.current = options?.onKickedFromDocument;

	const scheduleDeferredDisconnect = useCallback((socket: Socket): void => {
		if (disconnectRafRef.current !== null) {
			cancelAnimationFrame(disconnectRafRef.current);
			disconnectRafRef.current = null;
		}
		disconnectRafRef.current = requestAnimationFrame(() => {
			disconnectRafRef.current = null;
			try {
				socket.disconnect();
			} catch {
				// ignore
			}
		});
	}, []);

	const leave = useCallback(async (): Promise<void> => {
		const socket = socketRef.current;
		const borrowed = borrowedSharedSocketRef.current;
		activeDocIdRef.current = null;
		lastJoinRef.current = null;
		if (leaderWaitRetryTimerRef.current) {
			clearTimeout(leaderWaitRetryTimerRef.current);
			leaderWaitRetryTimerRef.current = null;
		}
		setIsConnected(false);
		setMySocketId(null);
		sessionUnbindRef.current?.();
		sessionUnbindRef.current = null;
		if (!socket) {
			borrowedSharedSocketRef.current = false;
			editorStoreApi.setState({ activeCollaborators: [] });
			return;
		}
		socketRef.current = null;
		borrowedSharedSocketRef.current = false;
		if (!borrowed) {
			authRefreshUnsubRef.current?.();
			authRefreshUnsubRef.current = null;
		}
		lastCursorRef.current = null;
		if (cursorThrottleRef.current) {
			clearTimeout(cursorThrottleRef.current);
			cursorThrottleRef.current = null;
		}
		editorStoreApi.setState({ activeCollaborators: [] });

		if (socket.connected) {
			socket.emit('leave_document');
		}
		if (borrowed) {
			return;
		}
		if (socket.connected) {
			socket.disconnect();
		} else {
			scheduleDeferredDisconnect(socket);
		}
	}, [editorStoreApi, scheduleDeferredDisconnect]);

	leaveRef.current = leave;

	const join = useCallback(
		async (
			documentId: string,
			joinOpts?: { ownerUserId?: string }
		): Promise<void> => {
			const token = getAuthToken();

			if (!token) {
				throw new Error('Authentication required for collaboration');
			}

			const prev = socketRef.current;
			const prevBorrowed = borrowedSharedSocketRef.current;
			if (prev) {
				sessionUnbindRef.current?.();
				sessionUnbindRef.current = null;
				socketRef.current = null;
				borrowedSharedSocketRef.current = false;
				lastCursorRef.current = null;
				if (cursorThrottleRef.current) {
					clearTimeout(cursorThrottleRef.current);
					cursorThrottleRef.current = null;
				}
				if (prev.connected) {
					prev.emit('leave_document');
				}
				if (!prevBorrowed) {
					authRefreshUnsubRef.current?.();
					authRefreshUnsubRef.current = null;
					try {
						prev.removeAllListeners();
					} catch {
						// ignore
					}
					if (prev.connected) {
						prev.disconnect();
					} else {
						scheduleDeferredDisconnect(prev);
					}
				}
			}
			editorStoreApi.setState({ activeCollaborators: [] });

			const forceNew = forceNewOnNextConnectRef.current;
			forceNewOnNextConnectRef.current = false;
			lastJoinRef.current = {
				documentId,
				ownerUserId: joinOpts?.ownerUserId,
			};

			let sharedSocket = !forceNew ? tryBorrowDesktopSocket() : null;
			if (sharedSocket && !sharedSocket.connected) {
				sharedSocket = null;
			}
			const singleTabPolicyEnabled = isSingleTabPolicyEnabled();
			let leaderSharedReady = Boolean(sharedSocket);
			if (
				singleTabPolicyEnabled &&
				isSocketOwner &&
				!sharedSocket &&
				!forceNew
			) {
				sharedSocket = await waitForBorrowableDesktopSocket(
					LEADER_SHARED_SOCKET_WAIT_MS
				);
				leaderSharedReady = Boolean(sharedSocket);
			}

			const plan = planDocEditorCollabSocket({
				forceNew,
				sharedSocketAvailable: sharedSocket != null,
				singleTabPolicyEnabled,
				isSocketOwner,
				leaderSharedSocketAvailableAfterWait: leaderSharedReady,
			});
			logCollabSocketPlan(plan);

			if (plan === 'skip_follower') {
				editorStoreApi.setState({ activeCollaborators: [] });
				setIsConnected(false);
				setMySocketId(null);
				return;
			}

			if (plan === 'skip_leader_wait') {
				editorStoreApi.setState({ activeCollaborators: [] });
				setIsConnected(false);
				setMySocketId(null);
				const pending = lastJoinRef.current;
				if (pending && isSocketOwner) {
					if (leaderWaitRetryTimerRef.current) {
						clearTimeout(leaderWaitRetryTimerRef.current);
					}
					leaderWaitRetryTimerRef.current = setTimeout(() => {
						leaderWaitRetryTimerRef.current = null;
						const still = lastJoinRef.current;
						if (still && still.documentId === pending.documentId) {
							void joinRef.current(still.documentId, {
								ownerUserId: still.ownerUserId,
							});
						}
					}, LEADER_WAIT_RETRY_MS);
				}
				return;
			}

			const borrowed = plan === 'borrow';
			borrowedSharedSocketRef.current = borrowed;

			const socket =
				borrowed && sharedSocket
					? sharedSocket
					: io(SOCKET_URL, {
							...eliteewSocketIoTransportOptions(),
							auth: buildSocketAuthPayload(token),
							withCredentials: true,
							reconnection: true,
							forceNew,
						});

			socketRef.current = socket;

			if (!borrowed) {
				authRefreshUnsubRef.current?.();
				authRefreshUnsubRef.current = bindSocketAuthRefresh(
					() => socketRef.current
				);
			}

			const docId = documentId;
			activeDocIdRef.current = docId;
			const ownerUserId = joinOpts?.ownerUserId?.trim() ?? '';

			const emitJoinDocument = (): void => {
				if (activeDocIdRef.current !== docId) {
					return;
				}
				socket.emit('join_document', {
					document_id: docId,
					...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
				});
				socket.emit('get_collaborators', { document_id: docId });
			};

			const onConnect: SocketEventHandler = () => {
				setIsConnected(true);
				setMySocketId(socket.id ?? null);
				emitJoinDocument();
			};

			const onDisconnect: SocketEventHandler = (reason: unknown) => {
				setIsConnected(false);
				setMySocketId(null);
				if (borrowedSharedSocketRef.current) {
					return;
				}
				const lastJoin = lastJoinRef.current;
				if (
					lastJoin &&
					typeof reason === 'string' &&
					shouldForceNewOnTransportDisconnect(reason) &&
					activeDocIdRef.current === lastJoin.documentId
				) {
					forceNewOnNextConnectRef.current = true;
					disableSocketIoAutoReconnect(socket);
					sessionUnbindRef.current?.();
					sessionUnbindRef.current = null;
					socket.removeAllListeners();
					socket.disconnect();
					socketRef.current = null;
					borrowedSharedSocketRef.current = false;
					void join(lastJoin.documentId, {
						ownerUserId: lastJoin.ownerUserId,
					});
				}
			};

			const onConnectError: SocketEventHandler = (err: unknown) => {
				if (borrowedSharedSocketRef.current) {
					setIsConnected(false);
					setMySocketId(null);
					void handleSocketConnectAuthError(err, {
						reconnect: () => {
							patchSocketAuth(socket, getAuthToken());
							if (!socket.connected) {
								socket.connect();
							}
						},
						patchAuth: (nextToken) => patchSocketAuth(socket, nextToken),
					});
					return;
				}
				const parsed = parseSocketConnectError(err);
				if (parsed.isStaleEngineSession) {
					const lastJoin = lastJoinRef.current;
					if (!lastJoin) {
						return;
					}
					forceNewOnNextConnectRef.current = true;
					disableSocketIoAutoReconnect(socket);
					sessionUnbindRef.current?.();
					sessionUnbindRef.current = null;
					socket.removeAllListeners();
					socket.disconnect();
					socketRef.current = null;
					borrowedSharedSocketRef.current = false;
					setIsConnected(false);
					setMySocketId(null);
					void join(lastJoin.documentId, {
						ownerUserId: lastJoin.ownerUserId,
					});
					return;
				}
				const errorObj = err instanceof Error ? err : new Error(String(err));
				log.error('UltimateDocEditor', 'Socket.IO connection error', errorObj);
				setIsConnected(false);
				setMySocketId(null);
				void handleSocketConnectAuthError(err, {
					reconnect: () => {
						patchSocketAuth(socket, getAuthToken());
						socket.connect();
					},
					patchAuth: (nextToken) => patchSocketAuth(socket, nextToken),
				});
			};

			const onDocEditorSessionEnded: SocketEventHandler = () => {
				void (async () => {
					await leaveRef.current();
					onSessionEndedRef.current?.();
				})();
			};

			const onKickedFromDocument: SocketEventHandler = () => {
				void (async () => {
					await leaveRef.current();
					onKickedRef.current?.();
				})();
			};

			const onUserJoined: SocketEventHandler = (data: unknown) => {
				const collaborator = data as CollaboratorInfo;
				editorStoreApi.setState((state) => ({
					activeCollaborators: [...state.activeCollaborators, collaborator],
				}));
			};

			const onUserLeft: SocketEventHandler = (data: unknown) => {
				const payload = data as { user_id: string };
				editorStoreApi.setState((state) => ({
					activeCollaborators: state.activeCollaborators.filter(
						(c) => c.user_id !== payload.user_id
					),
				}));
			};

			const onCursorUpdate: SocketEventHandler = (data: unknown) => {
				const payload = data as {
					user_id: string;
					cursor_position: CollaboratorInfo['cursor_position'];
				};
				editorStoreApi.setState((state) => ({
					activeCollaborators: state.activeCollaborators.map((c) =>
						c.user_id === payload.user_id
							? { ...c, cursor_position: payload.cursor_position }
							: c
					),
				}));
			};

			const onCollaboratorsList: SocketEventHandler = (data: unknown) => {
				const payload = data as { collaborators: CollaboratorInfo[] };
				editorStoreApi.setState({
					activeCollaborators: payload.collaborators,
				});
			};

			sessionUnbindRef.current?.();
			sessionUnbindRef.current = bindTrackedHandlers(socket, [
				['connect', onConnect],
				['disconnect', onDisconnect],
				['connect_error', onConnectError],
				['doc_editor_session_ended', onDocEditorSessionEnded],
				['kicked_from_document', onKickedFromDocument],
				['user_joined', onUserJoined],
				['user_left', onUserLeft],
				['cursor_update', onCursorUpdate],
				['collaborators_list', onCollaboratorsList],
			]);

			if (socket.connected) {
				setIsConnected(true);
				setMySocketId(socket.id ?? null);
				emitJoinDocument();
			}
		},
		[editorStoreApi, isSocketOwner, scheduleDeferredDisconnect]
	);

	joinRef.current = join;

	// Desktop borrows Services.socket: after presence supersede / forceNew the io()
	// instance is replaced — re-bind and re-emit join_document without asking the user
	// to refresh the page.
	useEffect(() => {
		const svc = Services.socket;
		if (!svc || typeof svc.addEventListener !== 'function') {
			return;
		}
		const onRestored = () => {
			const pending = lastJoinRef.current;
			if (!pending) {
				return;
			}
			const fresh = tryBorrowDesktopSocket();
			if (
				!shouldRejoinDocCollabOnSocketRestored({
					hasPendingJoin: true,
					freshSocket: fresh,
					currentSocket: socketRef.current,
					borrowed: borrowedSharedSocketRef.current,
					currentConnected: Boolean(socketRef.current?.connected),
				})
			) {
				return;
			}
			void joinRef.current(pending.documentId, {
				ownerUserId: pending.ownerUserId,
			});
		};
		return svc.addEventListener('connection-restored', onRestored);
	}, []);

	const kickParticipant = useCallback((targetSid: string): void => {
		const socket = socketRef.current;
		const docId = activeDocIdRef.current;
		if (!socket?.connected || !docId || !targetSid.trim()) return;
		socket.emit('kick_document_user', {
			document_id: docId,
			target_sid: targetSid.trim(),
		});
	}, []);

	const updateCursor = useCallback(
		(position: { line: number; column: number }): void => {
			const socket = socketRef.current;
			if (!socket?.connected) return;
			const prev = lastCursorRef.current;
			if (
				prev &&
				prev.line === position.line &&
				prev.column === position.column
			)
				return;
			lastCursorRef.current = position;

			const mySid = socket.id;
			if (mySid) {
				editorStoreApi.setState((state) => ({
					activeCollaborators: state.activeCollaborators.map((c) =>
						c.user_id === mySid ? { ...c, cursor_position: position } : c
					),
				}));
			}

			if (cursorThrottleRef.current) return;
			socket.emit('cursor_move', { cursor_position: position });
			cursorThrottleRef.current = setTimeout(() => {
				cursorThrottleRef.current = null;
			}, CURSOR_THROTTLE_MS);
		},
		[editorStoreApi]
	);

	useEffect(() => {
		return () => {
			if (leaderWaitRetryTimerRef.current) {
				clearTimeout(leaderWaitRetryTimerRef.current);
				leaderWaitRetryTimerRef.current = null;
			}
			if (cursorThrottleRef.current) {
				clearTimeout(cursorThrottleRef.current);
				cursorThrottleRef.current = null;
			}
			if (disconnectRafRef.current !== null) {
				cancelAnimationFrame(disconnectRafRef.current);
				disconnectRafRef.current = null;
			}
			sessionUnbindRef.current?.();
			sessionUnbindRef.current = null;
			const socket = socketRef.current;
			const borrowed = borrowedSharedSocketRef.current;
			if (socket) {
				socketRef.current = null;
				borrowedSharedSocketRef.current = false;
				lastCursorRef.current = null;
				if (!borrowed) {
					authRefreshUnsubRef.current?.();
					authRefreshUnsubRef.current = null;
				}
				disconnectRafRef.current = requestAnimationFrame(() => {
					disconnectRafRef.current = null;
					try {
						if (socket.connected) {
							socket.emit('leave_document');
						}
						if (!borrowed) {
							socket.disconnect();
						}
					} catch {
						// ignore
					}
				});
			}
		};
	}, []);

	return {
		collaborators: activeCollaborators,
		isConnected,
		error: undefined,
		join,
		leave,
		updateCursor,
		kickParticipant,
		mySocketId,
	};
};
