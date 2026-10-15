/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SPA Socket.IO client singleton: connect lifecycle, heartbeat, listener fan-out.
 * Payload types live in `emperyworldSocketTypes.ts`; inbound binds in `emperyworldSocketInboundHandlers.ts`.
 *
 * Invariants:
 * - Не логировать токены; Socket.IO получает только текущий Bearer в `auth.token`.
 * - `launchSocketIoHandshake` всегда вызывает `teardownSocketInstance()` перед новым `io()` (destroy-before-create).
 * - Интерактивный login запускается через `beginInteractiveLogin`, не напрямую из socket layer.
 *
 * Related:
 * - `hooks/useSocketConnection.tsx`, `services/authSession.ts`, `utils/authRedirect.ts`
 * - `services/maintenance/maintenanceState.ts`
 * - `emperyworldSocketTypes.ts`, `emperyworldSocketInboundHandlers.ts`
 * - `documentation/platform/REALTIME-SOCKETIO-AND-WS.md`
 */

import { io, type Socket } from 'socket.io-client';
import { ensureAccessTokenMinValidity, getToken } from '../authSession';
import {
	ensureDesktopRealtimePerfConsoleInstalled,
	isDesktopRealtimePerfMode,
	markSocketArrival,
	registerDesktopRealtimePerfStormEmitter,
} from './desktopRealtimePerfTelemetry';
import {
	bindSocketAuthRefresh,
	buildSocketAuthPayload,
} from '../auth/authenticatedSocketAuth';
import {
	disableSocketIoAutoReconnect,
	eliteewSocketIoTransportOptions,
} from '../auth/socketIoClientPolicy';
import { BaseService, type ServiceResponse } from '../core/BaseService';
import { resolveSocketIoHttpOrigin } from '../api/config';
import { ServiceError, ServiceErrorFactory } from '../core/ServiceError';
import { bindEmperyworldSocketInboundHandlers } from './emperyworldSocketInboundHandlers';
import type {
	EmperyworldSocketConnectionState,
	SocketConnectionConfig,
} from './emperyworldSocketTypes';

export type {
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
	GafChatSocketEventName,
	NotificationEvent,
	SocketConnectionConfig,
	VideoCallAcceptedPayload,
	VideoCallEndedPayload,
	VideoCallIncomingPayload,
} from './emperyworldSocketTypes';

const DEFAULT_MAX_OUTGOING_PAYLOAD_BYTES = 1_048_576;

async function fetchServerAppBuildId(): Promise<string | null> {
	try {
		const r = await fetch(`/app-build-version.txt?t=${Date.now()}`, {
			cache: 'no-store',
		});
		if (!r.ok) return null;
		const t = (await r.text()).trim();
		return t || null;
	} catch {
		return null;
	}
}

// ============= EMPERYWORLD SOCKET SERVICE =============

export class EmperyworldSocketService extends BaseService {
	private socket: Socket | null = null;
	private _forceNewOnNextConnect = false;
	private connectionState: EmperyworldSocketConnectionState = 'disconnected';
	private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private messageQueue: Array<{ event: string; data: unknown }> = [];
	/** Set when server rejects duplicate browser realtime; blocks auto-reconnect storm. */
	private presenceSuperseded = false;

	// User context
	private userContext: {
		user_id?: string;
		user_name?: string;
		session_id?: string;
		capabilities?: string[];
	} = {};

	// Performance tracking
	private performanceMetrics = {
		messages_sent: 0,
		messages_received: 0,
		/** Wall time when the current socket session connected; 0 if disconnected. */
		connection_started_at_ms: 0,
		last_latency_ms: 0,
		reconnections: 0,
		errors: 0,
	};

	// Socket-specific configuration
	private socketConfig: SocketConnectionConfig = {
		auto_connect: false, // PERFORMANCE: не подключаемся автоматически
		reconnect_enabled: true,
		max_reconnect_attempts: 10,
		reconnect_delay_ms: 2000, // INCREASED from 1000
		heartbeat_interval_ms: 30000, // INCREASED from 5000
		timeout_ms: 20000,
		compression_enabled: true,
		upgrade_transport: true,
		max_outgoing_payload_bytes: DEFAULT_MAX_OUTGOING_PAYLOAD_BYTES,
	};

	private connectPromise: Promise<
		ServiceResponse<{ connected: boolean; session_id: string }>
	> | null = null;
	private authRefreshUnsub: (() => void) | null = null;

	private pendingConnectResolve:
		| ((
				result: ServiceResponse<{ connected: boolean; session_id: string }>
		  ) => void)
		| null = null;

	// 🔥💎 REMOVED READONLY CONFIG OVERRIDE (Perfect Services Architecture compliant)

	constructor(customConfig?: Partial<SocketConnectionConfig>) {
		super('WEBSOCKET');

		ensureDesktopRealtimePerfConsoleInstalled();
		registerDesktopRealtimePerfStormEmitter((eventType, data) => {
			this.perfEmitSyntheticEvent(eventType, data);
		});

		// Apply custom configuration
		if (customConfig) {
			this.socketConfig = { ...this.socketConfig, ...customConfig };
		}

		this.initializeEventHandlers();
	}

	protected getServiceName(): string {
		return 'EmperyworldSocketService';
	}

	private finishInitialConnect(
		result: ServiceResponse<{ connected: boolean; session_id: string }>
	): void {
		const resolve = this.pendingConnectResolve;
		this.pendingConnectResolve = null;
		this.connectPromise = null;
		resolve?.(result);
	}

	private launchSocketIoHandshake(accessToken: string): void {
		if (this.socket) {
			this.teardownSocketInstance();
		}
		const socketUrl = this.getSocketURL();
		const forceNew = this._forceNewOnNextConnect;
		this._forceNewOnNextConnect = false;
		this.socket = io(socketUrl, {
			...eliteewSocketIoTransportOptions(),
			upgrade: this.socketConfig.upgrade_transport,
			timeout: this.socketConfig.timeout_ms,
			autoConnect: false,
			forceNew,
			reconnection: this.socketConfig.reconnect_enabled,
			reconnectionAttempts: this.socketConfig.max_reconnect_attempts,
			reconnectionDelay: this.socketConfig.reconnect_delay_ms,
			auth: buildSocketAuthPayload(accessToken, {
				user_id: this.userContext.user_id,
				user_name: this.userContext.user_name,
				capabilities: this.userContext.capabilities || ['chat', 'monitoring'],
				client_type: 'web_client',
				client_version: '4.0',
			}),
		});

		this.setupSocketEventHandlers();
		this.authRefreshUnsub?.();
		this.authRefreshUnsub = bindSocketAuthRefresh(() => this.socket);
		this.socket.connect();

		this.logger.info('Empery World Socket connection initiated', {
			url: socketUrl,
			user_id: this.userContext.user_id,
			capabilities: this.userContext.capabilities,
			forceNew,
		});
	}

	/** Re-handshake with forceNew while preserving an in-flight connect() promise. */
	private retryHandshakeAfterDelay(
		delayMs: number,
		options?: { forceNew?: boolean }
	): void {
		this._forceNewOnNextConnect = options?.forceNew === true;
		this.connectPromise = null;
		disableSocketIoAutoReconnect(this.socket);
		this.teardownSocketInstance();

		const resume = (): void => {
			const accessToken = getToken();
			if (this.pendingConnectResolve && accessToken) {
				this.connectionState = 'connecting';
				this.launchSocketIoHandshake(accessToken);
				return;
			}

			void this.connect({
				user_id: this.userContext.user_id,
				user_name: this.userContext.user_name,
				capabilities: this.userContext.capabilities,
			});
		};
		// Let the server process Engine.IO close and release browser_lease
		// before the new sid handshake (prod: reject-duplicate storm).
		globalThis.setTimeout(resume, delayMs);
	}

	/** Re-handshake with forceNew while preserving an in-flight connect() promise. */
	private retryForceNewHandshake(): void {
		this.retryHandshakeAfterDelay(120, { forceNew: true });
	}

	/** Retry the same handshake after a short delay so browser lease can clear. */
	private retryLeaseConflictHandshake(delayMs: number): void {
		this.retryHandshakeAfterDelay(delayMs);
	}

	private clearHeartbeatOnly(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	// ============= CONNECTION MANAGEMENT =============

	// Connect to Empery World WebSocket
	public async connect(userContext?: {
		user_id?: string;
		user_name?: string;
		capabilities?: string[];
	}): Promise<ServiceResponse<{ connected: boolean; session_id: string }>> {
		if (this.isConnected()) {
			return {
				success: true,
				data: {
					connected: true,
					session_id: this.userContext.session_id || '',
				},
			};
		}

		await ensureAccessTokenMinValidity(30);
		const accessToken = getToken();
		if (!accessToken) {
			const serviceError = ServiceErrorFactory.websocketError(
				this.getServiceName(),
				'connect',
				'Not authenticated (no access token for Socket.IO)'
			);
			return {
				success: false,
				error: serviceError,
				message: serviceError.getUserMessage(),
			};
		}

		if (this.connectPromise) {
			return this.connectPromise;
		}

		if (
			this.connectionState === 'reconnecting' &&
			this.socket &&
			this.socketConfig.reconnect_enabled
		) {
			if (this.socket.connected) {
				this.connectionState = 'connected';
				this.setupHeartbeat();
				this.processMessageQueue();
				const sessionId = this.socket.id || '';
				this.userContext.session_id = sessionId;
				return {
					success: true,
					data: { connected: true, session_id: sessionId },
				};
			}
			return new Promise((resolve) => {
				const s = this.socket;
				if (!s) {
					resolve({
						success: false,
						error: ServiceErrorFactory.websocketError(
							this.getServiceName(),
							'connect',
							'Socket not available'
						),
						message: ServiceErrorFactory.websocketError(
							this.getServiceName(),
							'connect',
							'Socket not available'
						).getUserMessage(),
					});
					return;
				}
				const onConnect = () => {
					s.off('connect_error', onConnectError);
					this.connectionState = 'connected';
					this.setupHeartbeat();
					this.processMessageQueue();
					const sessionId = this.socket?.id || '';
					this.userContext.session_id = sessionId;
					resolve({
						success: true,
						data: { connected: true, session_id: sessionId },
					});
				};
				const onConnectError = (error: Error) => {
					s.off('connect', onConnect);
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					const serviceError = ServiceErrorFactory.websocketError(
						this.getServiceName(),
						'connect',
						errorMessage
					);
					resolve({
						success: false,
						error: serviceError,
						message: serviceError.getUserMessage(),
					});
				};
				s.once('connect', onConnect);
				s.once('connect_error', onConnectError);
			});
		}

		this.connectPromise = new Promise((resolve) => {
			try {
				this.connectionState = 'connecting';
				this.userContext = { ...this.userContext, ...userContext };
				this.pendingConnectResolve = resolve;
				this.launchSocketIoHandshake(accessToken);
			} catch (error: unknown) {
				this.connectionState = 'disconnected';
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				const serviceError: ServiceError = ServiceErrorFactory.websocketError(
					this.getServiceName(),
					'connect',
					errorMessage
				);

				this.logger.error('Socket connection failed', serviceError);

				this.finishInitialConnect({
					success: false,
					error: serviceError,
					message: serviceError.getUserMessage(),
				});
			}
		});
		return this.connectPromise;
	}

	// Disconnect from WebSocket
	public disconnect(): ServiceResponse<{ disconnected: boolean }> {
		try {
			const sessionDurationMs = this.getConnectionDurationMs();
			this.disableSocketReconnection();
			this.cleanup();

			this.logger.info('Empery World Socket disconnected', {
				duration_ms: sessionDurationMs,
				messages_sent: this.performanceMetrics.messages_sent,
				messages_received: this.performanceMetrics.messages_received,
			});

			return {
				success: true,
				data: { disconnected: true },
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const serviceError = ServiceErrorFactory.websocketError(
				this.getServiceName(),
				'disconnect',
				errorMessage
			);

			return {
				success: false,
				error: serviceError,
				message: serviceError.getUserMessage(),
			};
		}
	}

	// Check connection status
	public isConnected(): boolean {
		return (
			this.connectionState === 'connected' && this.socket?.connected === true
		);
	}

	/** Native Socket.IO client for doc-editor collab multiplexing on desktop. */
	public getClientSocket(): Socket | null {
		return this.socket ?? null;
	}

	public getConnectionState(): string {
		return this.connectionState;
	}

	// ============= EVENT MANAGEMENT =============

	// Subscribe to events with automatic cleanup
	public addEventListener(
		eventType: string,
		handler: (data: unknown) => void
	): () => void {
		if (!this.eventListeners.has(eventType)) {
			this.eventListeners.set(eventType, new Set());
		}

		const listeners = this.eventListeners.get(eventType);
		if (!listeners) {
			throw new Error(`Event listeners not initialized for ${eventType}`);
		}
		listeners.add(handler);

		this.logger.debug('Event listener added', {
			eventType,
			totalListeners: this.eventListeners.size,
		});

		// Return unsubscribe function
		return () => {
			const listeners = this.eventListeners.get(eventType);
			if (listeners) {
				listeners.delete(handler);
				if (listeners.size === 0) {
					this.eventListeners.delete(eventType);
				}
			}
			this.logger.debug('Event listener removed', { eventType });
		};
	}

	/**
	 * Perf-only: fan-out a synthetic event to local listeners (no server I/O).
	 * Used by `window.__eliteewDesktopSocketStorm`.
	 */
	public perfEmitSyntheticEvent(eventType: string, data: unknown): void {
		if (!isDesktopRealtimePerfMode()) return;
		markSocketArrival(eventType);
		this.emitToListeners(eventType, data);
	}

	// Emit events to listeners
	private emitToListeners(eventType: string, data: unknown): void {
		const listeners = this.eventListeners.get(eventType);
		if (listeners && listeners.size > 0) {
			listeners.forEach((listener) => {
				try {
					listener(data);
				} catch (error) {
					const errorObj =
						error instanceof Error ? error : new Error(String(error));
					this.logger.error('Event listener error', errorObj, { eventType });
				}
			});
		}
	}

	// ============= PERFORMANCE & UTILITIES =============

	// Get performance metrics
	public getPerformanceMetrics(): {
		connection_state: string;
		connection_duration_ms: number;
		messages_sent: number;
		messages_received: number;
		last_latency_ms: number;
		reconnections: number;
		errors: number;
		active_listeners: number;
		queued_messages: number;
	} {
		return {
			connection_state: this.connectionState,
			connection_duration_ms: this.getConnectionDurationMs(),
			messages_sent: this.performanceMetrics.messages_sent,
			messages_received: this.performanceMetrics.messages_received,
			last_latency_ms: this.performanceMetrics.last_latency_ms,
			reconnections: this.performanceMetrics.reconnections,
			errors: this.performanceMetrics.errors,
			active_listeners: this.eventListeners.size,
			queued_messages: this.messageQueue.length,
		};
	}

	// Send heartbeat
	public sendHeartbeat(): ServiceResponse<{ sent: boolean }> {
		if (!this.isConnected()) {
			return { success: true, data: { sent: false } }; // Not an error if not connected
		}

		try {
			const timestamp = new Date().toISOString();
			if (!this.socket) {
				const error = ServiceErrorFactory.websocketError(
					this.getServiceName(),
					'sendHeartbeat',
					'Socket not initialized'
				);
				return { success: false, error, message: error.getUserMessage() };
			}
			this.socket.emit('emperyworld-heartbeat', {
				user_id: this.userContext.user_id,
				timestamp,
				performance_metrics: this.getPerformanceMetrics(),
			});

			this.logger.debug('Heartbeat sent', { timestamp });
			return { success: true, data: { sent: true } };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const serviceError = ServiceErrorFactory.websocketError(
				this.getServiceName(),
				'sendHeartbeat',
				errorMessage
			);
			return {
				success: false,
				error: serviceError,
				message: serviceError.getUserMessage(),
			};
		}
	}

	// Update user context
	public updateUserContext(updates: Partial<typeof this.userContext>): void {
		this.userContext = { ...this.userContext, ...updates };
		this.logger.info('User context updated', updates);
	}

	// ============= PRIVATE METHODS =============

	private getSocketURL(): string {
		// Opaque fofline-spa cannot be Engine.IO origin; shared resolver owns that.
		return resolveSocketIoHttpOrigin();
	}

	private setupSocketEventHandlers(): void {
		if (!this.socket) {
			return;
		}

		bindEmperyworldSocketInboundHandlers({
			socket: this.socket,
			logger: this.logger,
			performanceMetrics: this.performanceMetrics,
			getConnectionState: () => this.connectionState,
			setConnectionState: (state) => {
				this.connectionState = state;
			},
			getPresenceSuperseded: () => this.presenceSuperseded,
			setPresenceSuperseded: (value) => {
				this.presenceSuperseded = value;
			},
			isReconnectEnabled: () => this.socketConfig.reconnect_enabled,
			getUserId: () => this.userContext.user_id,
			getUserName: () => this.userContext.user_name,
			getCapabilities: () => this.userContext.capabilities,
			setSessionId: (sessionId) => {
				this.userContext.session_id = sessionId;
			},
			emitToListeners: (eventType, data) => {
				this.emitToListeners(eventType, data);
			},
			setupHeartbeat: () => {
				this.setupHeartbeat();
			},
			clearHeartbeatOnly: () => {
				this.clearHeartbeatOnly();
			},
			processMessageQueue: () => {
				this.processMessageQueue();
			},
			teardownSocketInstance: () => {
				this.teardownSocketInstance();
			},
			disableSocketReconnection: () => {
				this.disableSocketReconnection();
			},
			retryForceNewHandshake: () => {
				this.retryForceNewHandshake();
			},
			retryLeaseConflictHandshake: (delayMs) => {
				this.retryLeaseConflictHandshake(delayMs);
			},
			cleanup: () => {
				this.cleanup();
			},
			hasPendingConnectResolve: () => this.pendingConnectResolve != null,
			finishInitialConnect: (result) => {
				this.finishInitialConnect(result);
			},
			connect: (userContext) => this.connect(userContext),
			getServiceName: () => this.getServiceName(),
			fetchServerAppBuildId,
		});
	}

	private initializeEventHandlers(): void {
		this.eventListeners.clear();
	}

	private setupHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		this.heartbeatInterval = setInterval(() => {
			this.sendHeartbeat();
		}, this.socketConfig.heartbeat_interval_ms);
	}

	private processMessageQueue(): void {
		while (this.messageQueue.length > 0 && this.isConnected()) {
			const message = this.messageQueue.shift();
			if (!message) {
				break;
			}
			const { event, data } = message;
			try {
				if (!this.socket) {
					this.logger.warn('Socket not available, re-queuing message', {
						event,
					});
					this.messageQueue.unshift(message);
					break;
				}
				this.socket.emit(event, data);
			} catch (error) {
				const errorObj =
					error instanceof Error ? error : new Error(String(error));
				this.logger.error('Failed to send queued message', errorObj, { event });
			}
		}
	}

	private teardownSocketInstance(): void {
		this.disableSocketReconnection();
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}
	}

	private disableSocketReconnection(): void {
		if (this.socket?.io?.opts) {
			this.socket.io.opts.reconnection = false;
		}
	}

	private cleanup(): void {
		this.authRefreshUnsub?.();
		this.authRefreshUnsub = null;
		this.clearHeartbeatOnly();
		this.teardownSocketInstance();
		this.connectPromise = null;
		this.pendingConnectResolve = null;
		this.connectionState = 'disconnected';
		this.performanceMetrics.connection_started_at_ms = 0;
	}

	private getConnectionDurationMs(): number {
		const start = this.performanceMetrics.connection_started_at_ms;
		if (start <= 0 || this.connectionState !== 'connected') {
			return 0;
		}
		return Math.max(0, Date.now() - start);
	}
}

// Create singleton instance with performance optimized config
const emperyworldSocket = new EmperyworldSocketService({
	auto_connect: false, // NEVER auto-connect to prevent performance issues
	max_reconnect_attempts: 10,
	reconnect_delay_ms: 2000,
	heartbeat_interval_ms: 60000, // Heartbeat every 60 seconds instead of 5
	timeout_ms: 20000,
	compression_enabled: true, // Enable compression for better performance
	upgrade_transport: true, // Allow transport upgrades
});

export default emperyworldSocket;
