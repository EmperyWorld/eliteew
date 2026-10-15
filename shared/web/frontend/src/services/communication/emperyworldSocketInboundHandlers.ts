/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bind Socket.IO inbound handlers for EmperyworldSocketService (connect lifecycle + domain events).
 *
 * Invariants:
 * - Does not create sockets; only registers listeners on the provided Socket instance.
 * - Auth/stale/presence side effects go through deps callbacks (no token logging).
 *
 * Related:
 * - EmperyworldSocketService.ts
 * - emperyworldSocketTypes.ts
 * - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
 */

import type { Socket } from 'socket.io-client';
import {
	isBundleBuildMismatch,
	bundleMatchesServerBuild,
	reloadAllAppTabs,
} from '../../utils/staleBundleReload';
import {
	getCurrentMaintenanceStatus,
	isMaintenanceGatePhase,
	publishMaintenanceStatus,
} from '../maintenance/maintenanceState';
import { shouldBlockAutoReload } from '../maintenance/reloadCircuitBreaker';
import {
	handleSocketConnectAuthError,
	parseSocketConnectError,
	patchSocketAuth,
} from '../auth/authenticatedSocketAuth';
import { shouldForceNewOnTransportDisconnect } from '../auth/socketIoClientPolicy';
import { ServiceErrorFactory } from '../core/ServiceError';
import type { ServiceResponse } from '../core/BaseService';
import { markSocketArrival } from './desktopRealtimePerfTelemetry';
import { shouldRetrySocketAfterPresenceSuperseded } from './presenceSupersededReason';
import type {
	AIGenerationProgress,
	CreativeCollaboration,
	DocumentOperation,
	EmperyworldMessage,
	EmperyworldSocketConnectionState,
	EwDeskNewsUpdatedPayload,
	GafChatChatCreatedPayload,
	GafChatMessageDeletedPayload,
	GafChatMessageEditedPayload,
	GafChatMessageNewPayload,
	GafChatMessageReadPayload,
	NotificationEvent,
	VideoCallAcceptedPayload,
	VideoCallEndedPayload,
	VideoCallIncomingPayload,
} from './emperyworldSocketTypes';

const SOCKET_BROWSER_LEASE_RETRY_MS = 1200;

export type EmperyworldSocketInboundLogger = {
	info: (message: string, meta?: Record<string, unknown>) => void;
	warn: (message: string, meta?: Record<string, unknown>) => void;
	error: (
		message: string,
		error?: Error,
		meta?: Record<string, unknown>
	) => void;
};

export type EmperyworldSocketInboundPerf = {
	messages_received: number;
	connection_started_at_ms: number;
	last_latency_ms: number;
	reconnections: number;
	errors: number;
};

export type EmperyworldSocketInboundDeps = {
	socket: Socket;
	logger: EmperyworldSocketInboundLogger;
	performanceMetrics: EmperyworldSocketInboundPerf;
	getConnectionState: () => EmperyworldSocketConnectionState;
	setConnectionState: (state: EmperyworldSocketConnectionState) => void;
	getPresenceSuperseded: () => boolean;
	setPresenceSuperseded: (value: boolean) => void;
	isReconnectEnabled: () => boolean;
	getUserId: () => string | undefined;
	getUserName: () => string | undefined;
	getCapabilities: () => string[] | undefined;
	setSessionId: (sessionId: string) => void;
	emitToListeners: (eventType: string, data: unknown) => void;
	setupHeartbeat: () => void;
	clearHeartbeatOnly: () => void;
	processMessageQueue: () => void;
	teardownSocketInstance: () => void;
	disableSocketReconnection: () => void;
	retryForceNewHandshake: () => void;
	retryLeaseConflictHandshake: (delayMs: number) => void;
	cleanup: () => void;
	hasPendingConnectResolve: () => boolean;
	finishInitialConnect: (
		result: ServiceResponse<{ connected: boolean; session_id: string }>
	) => void;
	connect: (userContext?: {
		user_id?: string;
		user_name?: string;
		capabilities?: string[];
	}) => Promise<ServiceResponse<{ connected: boolean; session_id: string }>>;
	getServiceName: () => string;
	fetchServerAppBuildId: () => Promise<string | null>;
};

/**
 * Register all inbound Socket.IO listeners for the Emperyworld SPA client.
 */
export function bindEmperyworldSocketInboundHandlers(
	deps: EmperyworldSocketInboundDeps
): void {
	const { socket } = deps;

	socket.on('connect', () => {
		markSocketArrival('connect');
		const wasReconnecting = deps.getConnectionState() === 'reconnecting';
		deps.setConnectionState('connected');
		deps.performanceMetrics.connection_started_at_ms = Date.now();
		if (wasReconnecting) {
			deps.performanceMetrics.reconnections++;
		}
		markSocketArrival('connection-restored');
		deps.emitToListeners('connection-restored', {
			session_id: socket.id ?? '',
			initial: !wasReconnecting,
		});

		deps.setupHeartbeat();
		deps.processMessageQueue();

		const sessionId = socket.id || '';
		deps.setSessionId(sessionId);

		deps.logger.info('Socket connected', {
			sessionId,
			transport: socket.io.engine.transport.name,
			wasReconnecting,
		});

		if (deps.hasPendingConnectResolve()) {
			deps.finishInitialConnect({
				success: true,
				data: { connected: true, session_id: sessionId },
			});
		}
	});

	socket.on('disconnect', (reason) => {
		markSocketArrival('disconnect');
		deps.clearHeartbeatOnly();

		const intentional =
			reason === 'io client disconnect' ||
			!deps.isReconnectEnabled() ||
			deps.getPresenceSuperseded();

		if (intentional) {
			deps.teardownSocketInstance();
			deps.setConnectionState('disconnected');
			deps.performanceMetrics.connection_started_at_ms = 0;
			deps.setPresenceSuperseded(false);
			deps.logger.warn('Socket disconnected', { reason, intentional });
			deps.emitToListeners('connection-lost', { reason });
			return;
		}

		if (shouldForceNewOnTransportDisconnect(reason)) {
			deps.logger.warn(
				'Socket.IO transport loss — reconnecting with forceNew',
				{ reason }
			);
			deps.setConnectionState('reconnecting');
			deps.emitToListeners('connection-lost', { reason });
			deps.retryForceNewHandshake();
			return;
		}

		deps.setConnectionState('reconnecting');
		deps.logger.warn('Socket disconnected', { reason, intentional });
		deps.emitToListeners('connection-lost', { reason });
	});

	socket.on('connect_error', (error) => {
		markSocketArrival('connect_error');
		deps.performanceMetrics.errors++;

		const parsed = parseSocketConnectError(error);
		const errorMessage = error instanceof Error ? error.message : String(error);

		if (parsed.isStaleEngineSession) {
			deps.logger.warn(
				'Socket.IO stale Engine.IO session (400) — reconnecting with forceNew'
			);
			deps.retryForceNewHandshake();
			return;
		}

		if (parsed.isSingleBrowserRealtimeConflict) {
			deps.setConnectionState('reconnecting');
			deps.logger.warn(
				'Socket.IO browser lease busy — retrying after duplicate-session reject',
				{ reason: parsed.reason ?? 'single_browser_realtime' }
			);
			deps.retryLeaseConflictHandshake(SOCKET_BROWSER_LEASE_RETRY_MS);
			return;
		}

		if (parsed.isStaleClient) {
			deps.setPresenceSuperseded(true);
			deps.disableSocketReconnection();
			if (
				!getCurrentMaintenanceStatus().active &&
				!shouldBlockAutoReload('client_stale_connect_error')
			) {
				reloadAllAppTabs('client_stale_connect_error');
			}
			return;
		}

		void (async () => {
			if (
				getCurrentMaintenanceStatus().active ||
				shouldBlockAutoReload('socket_connect_bundle_mismatch')
			) {
				return;
			}
			const serverBuild = await deps.fetchServerAppBuildId();
			if (isBundleBuildMismatch(serverBuild)) {
				deps.setPresenceSuperseded(true);
				deps.disableSocketReconnection();
				reloadAllAppTabs('socket_connect_bundle_mismatch');
			}
		})();

		const serviceError = ServiceErrorFactory.websocketError(
			deps.getServiceName(),
			'connect',
			errorMessage
		);

		if (parsed.isSessionReplaceConfirmationRequired || parsed.isAuthFailure) {
			if (parsed.isSessionReplaceConfirmationRequired) {
				deps.setConnectionState('disconnected');
				deps.logger.warn(
					'Socket auth requires browser session replacement confirmation.'
				);
			} else {
				deps.logger.warn(
					'Socket connection rejected (auth). Trying refresh before login.'
				);
			}
			if (deps.hasPendingConnectResolve()) {
				deps.finishInitialConnect({
					success: false,
					error: serviceError,
					message: serviceError.getUserMessage(),
				});
			}
			void handleSocketConnectAuthError(error, {
				reconnect: () => {
					void deps.connect({
						user_id: deps.getUserId(),
						user_name: deps.getUserName(),
						capabilities: deps.getCapabilities(),
					});
				},
				patchAuth: (token) => patchSocketAuth(socket, token),
			});
			return;
		}

		if (deps.hasPendingConnectResolve()) {
			deps.setConnectionState('disconnected');
		}

		deps.logger.error('Socket connection error', serviceError, {
			error: errorMessage,
		});

		if (deps.hasPendingConnectResolve()) {
			deps.finishInitialConnect({
				success: false,
				error: serviceError,
				message: serviceError.getUserMessage(),
			});
		}
	});

	socket.on('chat-message', (data: EmperyworldMessage) => {
		deps.performanceMetrics.messages_received++;
		deps.emitToListeners('message', data);
	});

	socket.on('ai-progress-update', (data: AIGenerationProgress) => {
		deps.emitToListeners('ai-progress', data);
	});

	socket.on('doc-state', (data: CreativeCollaboration) => {
		deps.emitToListeners('document-state', data);
	});

	socket.on('doc-operation', (data: DocumentOperation) => {
		deps.emitToListeners('document-operation', data);
	});

	socket.on('notification', (data: NotificationEvent) => {
		deps.emitToListeners('notification', data);
	});

	socket.on('notification_dismiss', (data: { id?: string }) => {
		deps.emitToListeners('notification_dismiss', data);
	});

	socket.on('friends.updated', (data: unknown) => {
		deps.emitToListeners('friends.updated', data);
	});

	socket.on('gaf_chat.message_new', (data: GafChatMessageNewPayload) => {
		markSocketArrival('gaf_chat.message_new');
		deps.performanceMetrics.messages_received++;
		deps.emitToListeners('gaf_chat.message_new', data);
	});
	socket.on('gaf_chat.message_read', (data: GafChatMessageReadPayload) => {
		markSocketArrival('gaf_chat.message_read');
		deps.emitToListeners('gaf_chat.message_read', data);
	});
	socket.on('gaf_chat.chat_created', (data: GafChatChatCreatedPayload) => {
		markSocketArrival('gaf_chat.chat_created');
		deps.emitToListeners('gaf_chat.chat_created', data);
	});
	socket.on('gaf_chat.message_edited', (data: GafChatMessageEditedPayload) => {
		markSocketArrival('gaf_chat.message_edited');
		deps.emitToListeners('gaf_chat.message_edited', data);
	});
	socket.on(
		'gaf_chat.message_deleted',
		(data: GafChatMessageDeletedPayload) => {
			markSocketArrival('gaf_chat.message_deleted');
			deps.emitToListeners('gaf_chat.message_deleted', data);
		}
	);
	socket.on('video_call.incoming', (data: VideoCallIncomingPayload) => {
		deps.emitToListeners('video_call.incoming', data);
	});
	socket.on('video_call.accepted', (data: VideoCallAcceptedPayload) => {
		deps.emitToListeners('video_call.accepted', data);
	});
	socket.on('video_call.ended', (data: VideoCallEndedPayload) => {
		deps.emitToListeners('video_call.ended', data);
	});

	socket.on('ewdesk.news_updated', (data: EwDeskNewsUpdatedPayload) => {
		deps.emitToListeners('ewdesk.news_updated', data);
	});

	socket.on('desktop_ai_chat.turn_started', (data: unknown) => {
		markSocketArrival('desktop_ai_chat.turn_started');
		deps.emitToListeners('desktop_ai_chat.turn_started', data);
	});
	socket.on('desktop_ai_chat.turn_done', (data: unknown) => {
		markSocketArrival('desktop_ai_chat.turn_done');
		deps.emitToListeners('desktop_ai_chat.turn_done', data);
	});
	socket.on('desktop_ai_chat.message_new', (data: unknown) => {
		markSocketArrival('desktop_ai_chat.message_new');
		deps.emitToListeners('desktop_ai_chat.message_new', data);
	});
	socket.on('desktop_ai_chat.member_changed', (data: unknown) => {
		markSocketArrival('desktop_ai_chat.member_changed');
		deps.emitToListeners('desktop_ai_chat.member_changed', data);
	});

	socket.on('system.maintenance', (data: unknown) => {
		const status = publishMaintenanceStatus(data);
		deps.emitToListeners('system.maintenance', data);
		if (isMaintenanceGatePhase(status)) {
			deps.disableSocketReconnection();
		}
	});

	socket.on('presence_superseded', (data: unknown) => {
		markSocketArrival('presence_superseded');
		deps.logger.info('presence_superseded received', { data });
		deps.emitToListeners('presence_superseded', data);
		if (shouldRetrySocketAfterPresenceSuperseded(data)) {
			return;
		}
		deps.setPresenceSuperseded(true);
		deps.disableSocketReconnection();
		deps.cleanup();
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
				serverBuild = await deps.fetchServerAppBuildId();
			}
			if (serverBuild && bundleMatchesServerBuild(serverBuild)) {
				deps.logger.warn(
					'client_stale ignored — bundle matches server; reconnecting',
					{ data, serverBuild }
				);
				deps.retryForceNewHandshake();
				return;
			}
			deps.logger.info('client_stale received — reloading all tabs', { data });
			deps.setPresenceSuperseded(true);
			deps.disableSocketReconnection();
			deps.emitToListeners('client_stale', data);
			deps.cleanup();
			if (!shouldBlockAutoReload('client_stale_socket')) {
				reloadAllAppTabs('client_stale_socket');
			}
		})();
	});

	socket.on('presence_admin_command', (data: unknown) => {
		let action: string | undefined;
		if (data && typeof data === 'object' && data !== null && 'action' in data) {
			const v = (data as { action?: unknown }).action;
			action = typeof v === 'string' ? v : undefined;
		}
		deps.logger.info('presence_admin_command received', { action });
		deps.emitToListeners('presence-admin-command', { action });
		if (action === 'reload') {
			reloadAllAppTabs('manual_user');
			return;
		}
		if (action === 'logout') {
			void import('../authSession')
				.then(({ logout }) => logout())
				.catch((err: unknown) => {
					const errorObj = err instanceof Error ? err : new Error(String(err));
					deps.logger.error('presence_admin_command logout failed', errorObj);
				});
		}
	});

	socket.on('heartbeat-response', (data: unknown) => {
		try {
			const rawTs =
				data && typeof data === 'object' && data !== null && 'timestamp' in data
					? (data as { timestamp: unknown }).timestamp
					: undefined;
			const t =
				typeof rawTs === 'string' || typeof rawTs === 'number'
					? new Date(rawTs).getTime()
					: NaN;
			if (!Number.isNaN(t)) {
				deps.performanceMetrics.last_latency_ms = Date.now() - t;
			}
		} catch (err: unknown) {
			deps.performanceMetrics.errors++;
			deps.logger.warn('heartbeat-response handling failed', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	});

	socket.on('error', (error: unknown) => {
		deps.performanceMetrics.errors++;
		const errorObj = error instanceof Error ? error : new Error(String(error));
		deps.logger.error('Socket error', errorObj);
		deps.emitToListeners('socket-error', errorObj);
	});
}
