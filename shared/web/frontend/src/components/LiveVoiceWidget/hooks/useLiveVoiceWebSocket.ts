/**
 * useLiveVoiceWebSocket - Hook для WebSocket соединения с Live Voice API
 *
 * Поддерживает:
 * - Режим on/off (тумблер)
 * - Автоматический переход в неактивное состояние через 1 минуту
 * - Предзагрузку моделей при включении
 * - Real-time обработку аудио через WebSocket
 *
 * Оптимизации:
 * - Батчинг состояний для уменьшения ререндеров
 * - Debounce для аудио отправки
 * - Умный reconnection с exponential backoff
 * - Мемоизация всех callbacks
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, authSession } from '../../../services/authSession';
import { subscribeTokenExpired } from '../../../services/keycloak';
import { log } from '../../../utils/logger';
import { LIVE_VOICE_SETTINGS_SAVED_EVENT } from '../../../voice-core';

interface WebSocketMessage {
	type: string;
	message?: string;
	text?: string;
	audio_url?: string;
	duration_ms?: number;
	timestamp?: string;
	active?: boolean;
}

interface UseLiveVoiceWebSocketOptions {
	sessionId: string;
	/** If false, call `connect()` or `setActive(true)` to open the socket (saves idle sessions). Default true. */
	autoConnect?: boolean;
	onTranscription?: (text: string) => void;
	onResponse?: (text: string) => void;
	onAudio?: (audioUrl: string) => void | Promise<void>;
	onError?: (error: Error) => void;
	onModelsReady?: () => void;
	onInactive?: () => void;
}

interface UseLiveVoiceWebSocketReturn {
	isConnected: boolean;
	isActive: boolean;
	modelsReady: boolean;
	connect: () => void;
	disconnect: () => void;
	setActive: (active: boolean) => void;
	sendAudio: (audioBlob: Blob) => void;
	error: Error | null;
}

// ✅ FIX: Коды ошибок, которые не должны вызывать переподключение (константа вне компонента)
const NO_RECONNECT_CODES: readonly number[] = [
	1000, // Normal closure
	1008, // Policy violation (authentication)
	1002, // Protocol error
	1003, // Unsupported data
	1007, // Invalid frame payload data
	1011, // Internal server error (серверная ошибка, не переподключаемся)
	1012, // Service restart (сервис перезапускается)
	1013, // Try again later (сервис временно недоступен)
	1014, // Bad gateway (проблема с прокси)
	1015, // TLS handshake failure
];

export const useLiveVoiceWebSocket = (
	options: UseLiveVoiceWebSocketOptions
): UseLiveVoiceWebSocketReturn => {
	const {
		sessionId,
		onTranscription,
		onResponse,
		onAudio,
		onError,
		onModelsReady,
		onInactive,
	} = options;

	const autoConnectRef = useRef(options.autoConnect !== false);
	autoConnectRef.current = options.autoConnect !== false;

	const [isConnected, setIsConnected] = useState(false);
	const [isActive, setIsActive] = useState(false);
	const [modelsReady, setModelsReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const pendingActiveStateRef = useRef<boolean | null>(null); // Сохраняем состояние для применения после подключения
	const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ FIX: Таймер для задержки отключения
	const userToggledRef = useRef<number>(0); // ✅ FIX: Время последнего переключения пользователем (timestamp)
	const shouldReconnectRef = useRef(true); // ✅ FIX: Флаг для остановки переподключений
	const lastReconnectAttemptRef = useRef<number>(0); // ✅ FIX: Время последней попытки переподключения
	const connectionErrorRef = useRef<string | null>(null); // ✅ FIX: Сохраняем последнюю ошибку подключения
	const isInitialMountRef = useRef(true); // ✅ FIX: Флаг первого монтирования
	const maxReconnectAttempts = 5;
	const DISCONNECT_DELAY = 300; // ✅ OPTIMIZED: Уменьшена задержка для более быстрого отклика
	const TOGGLE_DEBOUNCE = 800; // ✅ OPTIMIZED: Уменьшен debounce для более отзывчивого UI
	const MIN_RECONNECT_INTERVAL = 1500; // ✅ OPTIMIZED: Уменьшен интервал для более быстрого восстановления
	const AUDIO_SEND_TIMEOUT = 100; // ✅ NEW: Таймаут для батчинга аудио

	// ✅ NEW: Ref для батчинга аудио данных
	const audioBatchRef = useRef<ArrayBuffer[]>([]);
	const audioBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const getWebSocketUrl = useCallback((): string => {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const host = window.location.host;
		return `${protocol}//${host}/api/v1/live-voice/ws/${sessionId}`;
	}, [sessionId]);

	const stopReconnection = useCallback((): void => {
		shouldReconnectRef.current = false;

		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}

		if (disconnectTimeoutRef.current) {
			clearTimeout(disconnectTimeoutRef.current);
			disconnectTimeoutRef.current = null;
		}
	}, []);

	const handleMessage = useCallback(
		(message: WebSocketMessage): void => {
			switch (message.type) {
				case 'connected':
					log.info('LiveVoiceWebSocket', '✅ WebSocket connected', {
						message: message.message,
					});
					break;

				case 'auth_ok':
					log.info('LiveVoiceWebSocket', '🔐 WebSocket authenticated');
					break;

				case 'models_ready':
					log.info('LiveVoiceWebSocket', '✅ Models ready', {
						message: message.message,
					});
					setModelsReady(true);
					onModelsReady?.();
					break;

				case 'active_state': {
					// ✅ FIX: Игнорируем автоматическое изменение состояния, если пользователь недавно переключил тумблер
					const now = Date.now();
					if (now - userToggledRef.current > TOGGLE_DEBOUNCE) {
						setIsActive(message.active || false);
						log.info(
							'LiveVoiceWebSocket',
							`🔄 Active state: ${message.active ? 'ON' : 'OFF'}`
						);
					} else {
						log.info(
							'LiveVoiceWebSocket',
							`⏸️ Ignoring active_state (user toggled ${now - userToggledRef.current}ms ago)`
						);
					}
					break;
				}

				case 'transcribing':
					log.info('LiveVoiceWebSocket', '📝 Transcribing', {
						message: message.message,
					});
					break;

				case 'transcription':
					log.info('LiveVoiceWebSocket', '📝 Transcription', {
						text: message.text,
					});
					if (message.text) {
						onTranscription?.(message.text);
					}
					break;

				case 'generating':
					log.info('LiveVoiceWebSocket', '🤖 Generating', {
						message: message.message,
					});
					break;

				case 'response_text':
					log.info('LiveVoiceWebSocket', '🤖 Response', { text: message.text });
					if (message.text) {
						onResponse?.(message.text);
					}
					break;

				case 'synthesizing':
					log.info('LiveVoiceWebSocket', '🔊 Synthesizing', {
						message: message.message,
					});
					break;

				case 'tts_audio':
					log.info('LiveVoiceWebSocket', '🔊 TTS Audio ready', {
						audio_url: message.audio_url,
					});
					if (message.audio_url) {
						void Promise.resolve(onAudio?.(message.audio_url));
					}
					break;

				case 'inactive':
					log.info('LiveVoiceWebSocket', '⏱️ Inactive', {
						message: message.message,
					});
					setIsActive(false);
					setModelsReady(false);
					onInactive?.();
					break;

				case 'error':
					{
						const errorMessage = message.message || 'Unknown error';
						log.error(
							'LiveVoiceWebSocket',
							'❌ WebSocket error',
							new Error(errorMessage),
							{ message: errorMessage }
						);
						const error = new Error(errorMessage);
						setError(error);
						onError?.(error);

						// Если backend недоступен (например, внутренний хост 192.168.1.141), прекращаем переподключения
						const lower = errorMessage.toLowerCase();
						const backendDown =
							lower.includes('cannot connect to host') ||
							lower.includes('ssl:default') ||
							lower.includes('connection refused') ||
							lower.includes('insufficient resources');

						if (backendDown) {
							log.warn(
								'LiveVoiceWebSocket',
								'🛑 Backend unreachable, stopping reconnection',
								{ errorMessage }
							);
							stopReconnection();
							setIsConnected(false);
							setIsActive(false);
							setModelsReady(false);
						}
					}
					break;

				case 'pong':
					// Heartbeat response
					break;

				default:
					log.warn('LiveVoiceWebSocket', 'Unknown message type', {
						type: message.type,
					});
			}
		},
		[
			onTranscription,
			onResponse,
			onAudio,
			onError,
			onModelsReady,
			onInactive,
			stopReconnection,
		]
	);

	const connect = useCallback((): void => {
		// ✅ FIX: Проверка на флаг shouldReconnect перед попыткой подключения
		if (!shouldReconnectRef.current) {
			log.warn(
				'LiveVoiceWebSocket',
				'🔌 Live Voice WebSocket: Reconnection disabled, skipping connect'
			);
			return;
		}

		const rs = wsRef.current?.readyState;
		if (rs === WebSocket.OPEN) {
			return; // Already connected
		}
		if (rs === WebSocket.CONNECTING) {
			return;
		}

		// ✅ FIX: Проверка на слишком частые попытки подключения
		const now = Date.now();
		const timeSinceLastAttempt = now - lastReconnectAttemptRef.current;
		if (
			timeSinceLastAttempt < MIN_RECONNECT_INTERVAL &&
			lastReconnectAttemptRef.current > 0
		) {
			const waitTime = MIN_RECONNECT_INTERVAL - timeSinceLastAttempt;
			// ✅ FIX: Не логируем как предупреждение - это нормальное поведение защиты
			// Логируем только в dev режиме для отладки
			if (import.meta.env.DEV) {
				log.info(
					'LiveVoiceWebSocket',
					`⏱️ Live Voice WebSocket: Rate limiting - waiting ${waitTime}ms`,
					{ waitTime, timeSinceLastAttempt }
				);
			}
			return;
		}

		try {
			const url = getWebSocketUrl();
			const ws = new WebSocket(url);
			lastReconnectAttemptRef.current = now; // ✅ FIX: Сохраняем время попытки подключения

			ws.onopen = (): void => {
				log.info('LiveVoiceWebSocket', '🔌 Live Voice WebSocket connected');
				setIsConnected(true);
				setError(null);
				reconnectAttemptsRef.current = 0;
				shouldReconnectRef.current = true; // ✅ FIX: Сбрасываем флаг при успешном подключении
				lastReconnectAttemptRef.current = 0; // ✅ FIX: Сбрасываем время последней попытки
				connectionErrorRef.current = null; // ✅ FIX: Сбрасываем сохраненную ошибку

				const token = getToken();
				if (!token) {
					const authError = new Error('No authentication token available');
					setError(authError);
					onError?.(authError);
					ws.close(1008, 'Authentication required');
					return;
				}

				ws.send(JSON.stringify({ type: 'auth', token }));

				// Применяем сохраненное активное состояние после подключения
				if (pendingActiveStateRef.current !== null) {
					const activeState = pendingActiveStateRef.current;
					pendingActiveStateRef.current = null;
					ws.send(
						JSON.stringify({
							type: 'set_active',
							active: activeState,
						})
					);
					setIsActive(activeState);
				} else if (isActive) {
					// Если состояние уже было установлено до подключения
					ws.send(
						JSON.stringify({
							type: 'set_active',
							active: true,
						})
					);
				}
			};

			ws.onmessage = (event: MessageEvent): void => {
				try {
					const data =
						typeof event.data === 'string' ? event.data : String(event.data);
					const message: WebSocketMessage = JSON.parse(
						data
					) as WebSocketMessage;
					handleMessage(message);
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					log.error(
						'LiveVoiceWebSocket',
						'Failed to parse WebSocket message',
						error
					);
				}
			};

			ws.onerror = (event: Event): void => {
				// ✅ FIX: Улучшенная обработка WebSocket ошибок
				setIsConnected(false);

				// ✅ FIX: Пытаемся получить информацию об ошибке из события
				// В браузере ошибка WebSocket может содержать информацию в event
				const errorMessage =
					(event as ErrorEvent)?.message || 'WebSocket connection error';
				connectionErrorRef.current = errorMessage;

				// ✅ FIX: Проверка на системные ошибки (Insufficient resources и т.д.)
				const isSystemError =
					errorMessage.toLowerCase().includes('insufficient resources') ||
					errorMessage.toLowerCase().includes('resource') ||
					errorMessage.toLowerCase().includes('too many') ||
					errorMessage.toLowerCase().includes('limit');

				if (isSystemError) {
					log.warn(
						'LiveVoiceWebSocket',
						`⚠️ Live Voice WebSocket: System error detected - ${errorMessage} - stopping reconnection attempts`,
						{ error: errorMessage }
					);
					stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
					const error = new Error(`Connection failed: ${errorMessage}`);
					setError(error);
					onError?.(error);
				}

				// ✅ FIX: При ошибке устанавливаем флаг для проверки в onclose
				// Это поможет определить, нужно ли переподключаться
			};

			ws.onclose = (event: CloseEvent): void => {
				log.info('LiveVoiceWebSocket', '🔌 Live Voice WebSocket disconnected', {
					code: event.code,
					reason: event.reason,
				});
				wsRef.current = null;

				// ✅ FIX: Задержка перед показом отключения - стабилизируем индикатор
				// Очищаем предыдущий таймер если есть
				if (disconnectTimeoutRef.current) {
					clearTimeout(disconnectTimeoutRef.current);
				}

				// ✅ FIX: Проверка на "Intentional disconnect" — это нормальное, явное отключение пользователем
				const reason = event.reason || connectionErrorRef.current || '';
				if (event.code === 1000 && reason === 'Intentional disconnect') {
					// Никаких ошибок и переподключений, просто считаем соединение аккуратно закрытым
					if (import.meta.env.DEV) {
						log.info(
							'LiveVoiceWebSocket',
							'✅ Live Voice WebSocket: Intentional disconnect — no reconnection, no error'
						);
					}
					connectionErrorRef.current = null;
					// Состояние уже сброшено в disconnect(), здесь просто выходим
					return;
				}

				// ✅ FIX: Проверка на "Insufficient resources" и другие системные ошибки
				const isInsufficientResources =
					reason.toLowerCase().includes('insufficient resources') ||
					reason.toLowerCase().includes('resource') ||
					reason.toLowerCase().includes('too many') ||
					reason.toLowerCase().includes('limit') ||
					event.code === 1013; // Try again later

				// ✅ FIX: Сбрасываем сохраненную ошибку после использования
				connectionErrorRef.current = null;

				// ✅ FIX: Не переподключаемся при ошибке аутентификации (1008)
				// Это означает, что токен невалиден или истек - нужно обновить токен
				if (event.code === 1008) {
					if (import.meta.env.DEV) {
						log.warn(
							'LiveVoiceWebSocket',
							'🔐 Live Voice WebSocket: Authentication required - stopping reconnection attempts'
						);
						log.warn(
							'LiveVoiceWebSocket',
							'ℹ️ WebSocket will reconnect automatically when token is refreshed'
						);
					}
					setIsConnected(false);
					setModelsReady(false);
					stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
					return;
				}

				// ✅ FIX: Не переподключаемся при системных ошибках (Insufficient resources и т.д.)
				if (
					isInsufficientResources ||
					NO_RECONNECT_CODES.includes(event.code)
				) {
					const errorMessage = `Connection failed: ${reason || `Error code ${event.code}`}`;
					log.warn(
						'LiveVoiceWebSocket',
						`⚠️ Live Voice WebSocket: System error (code: ${event.code}, reason: ${reason}) - stopping reconnection attempts`,
						{ code: event.code, reason }
					);
					setIsConnected(false);
					setModelsReady(false);
					stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
					const error = new Error(errorMessage);
					setError(error);
					onError?.(error);
					return;
				}

				// ✅ FIX: Проверка на достижение максимума попыток
				if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
					const errorMessage =
						'Max reconnection attempts reached. Please refresh the page.';
					log.warn(
						'LiveVoiceWebSocket',
						`⚠️ Live Voice WebSocket: Max reconnection attempts (${maxReconnectAttempts}) reached - stopping reconnection`,
						{
							attempts: reconnectAttemptsRef.current,
							maxAttempts: maxReconnectAttempts,
						}
					);
					setIsConnected(false);
					setModelsReady(false);
					stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
					const error = new Error(errorMessage);
					setError(error);
					onError?.(error);
					return;
				}

				// ✅ FIX: Проверка на слишком частые попытки переподключения
				const now = Date.now();
				const timeSinceLastAttempt = now - lastReconnectAttemptRef.current;
				if (timeSinceLastAttempt < MIN_RECONNECT_INTERVAL) {
					const waitTime = MIN_RECONNECT_INTERVAL - timeSinceLastAttempt;
					log.warn(
						'LiveVoiceWebSocket',
						`⚠️ Live Voice WebSocket: Too frequent reconnection attempts - waiting ${waitTime}ms`,
						{ waitTime, timeSinceLastAttempt }
					);
					// ✅ FIX: Не переподключаемся слишком часто - просто показываем отключение
					// НЕ создаем новый таймер переподключения
					disconnectTimeoutRef.current = setTimeout(() => {
						setIsConnected(false);
						setModelsReady(false);
					}, DISCONNECT_DELAY);
					return;
				}

				// ✅ FIX: Проверка флага shouldReconnect перед переподключением
				if (!shouldReconnectRef.current) {
					log.info(
						'LiveVoiceWebSocket',
						'🔌 Live Voice WebSocket: Reconnection disabled'
					);
					disconnectTimeoutRef.current = setTimeout(() => {
						setIsConnected(false);
						setModelsReady(false);
					}, DISCONNECT_DELAY);
					return;
				}

				// Auto-reconnect if not intentional close
				if (event.code !== 1000) {
					// ✅ FIX: Проверяем флаг ЕЩЕ РАЗ перед созданием таймера переподключения
					// Это предотвращает создание таймера, если переподключения были отключены
					if (!shouldReconnectRef.current) {
						disconnectTimeoutRef.current = setTimeout(() => {
							setIsConnected(false);
							setModelsReady(false);
						}, DISCONNECT_DELAY);
						return;
					}

					// ✅ FIX: Проверка на достижение максимума попыток ПЕРЕД созданием таймера
					if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
						stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
						disconnectTimeoutRef.current = setTimeout(() => {
							setIsConnected(false);
							setModelsReady(false);
						}, DISCONNECT_DELAY);
						return;
					}

					const delay = Math.min(
						1000 * 2 ** reconnectAttemptsRef.current,
						10000
					);
					reconnectAttemptsRef.current++;
					lastReconnectAttemptRef.current = now; // ✅ FIX: Сохраняем время попытки
					log.info(
						'LiveVoiceWebSocket',
						`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
						{
							delay,
							attempt: reconnectAttemptsRef.current,
							maxAttempts: maxReconnectAttempts,
						}
					);

					// ✅ FIX: Не показываем отключение сразу, если переподключаемся
					// Устанавливаем отключение только если переподключение не удалось
					reconnectTimeoutRef.current = setTimeout(() => {
						// ✅ FIX: Проверяем флаг перед переподключением (еще раз для безопасности)
						if (
							shouldReconnectRef.current &&
							reconnectAttemptsRef.current <= maxReconnectAttempts
						) {
							connect();
							// Если после переподключения все еще не подключено, показываем отключение
							setTimeout(() => {
								if (
									!wsRef.current ||
									wsRef.current.readyState !== WebSocket.OPEN
								) {
									setIsConnected(false);
									setModelsReady(false);
								}
							}, DISCONNECT_DELAY);
						} else {
							setIsConnected(false);
							setModelsReady(false);
						}
					}, delay);
				} else {
					// ✅ FIX: Показываем отключение с задержкой для плавности
					disconnectTimeoutRef.current = setTimeout(() => {
						setIsConnected(false);
						setModelsReady(false);
					}, DISCONNECT_DELAY);
				}
			};

			wsRef.current = ws;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('LiveVoiceWebSocket', 'Failed to create WebSocket', error);

			// ✅ FIX: Проверка на системные ошибки при создании WebSocket
			const errorMessage = error.message.toLowerCase();
			const isSystemError =
				errorMessage.includes('insufficient resources') ||
				errorMessage.includes('resource') ||
				errorMessage.includes('too many') ||
				errorMessage.includes('limit');

			if (isSystemError) {
				log.warn(
					'LiveVoiceWebSocket',
					`⚠️ Live Voice WebSocket: System error during creation - ${error.message} - stopping reconnection attempts`,
					{ error: error.message }
				);
				stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
				setError(error);
				onError?.(error);
				return;
			}

			// ✅ FIX: При других ошибках увеличиваем счетчик попыток
			reconnectAttemptsRef.current++;
			if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
				stopReconnection(); // ✅ FIX: Останавливаем переподключения и очищаем таймеры
				setError(error);
				onError?.(error);
				return;
			}

			setError(error);
		}
	}, [getWebSocketUrl, handleMessage, isActive, onError, stopReconnection]);

	const disconnect = useCallback((): void => {
		// ✅ FIX: Останавливаем переподключения при явном отключении
		stopReconnection();

		if (wsRef.current) {
			wsRef.current.close(1000, 'Intentional disconnect');
			wsRef.current = null;
		}

		setIsConnected(false);
		setIsActive(false);
		setModelsReady(false);
	}, [stopReconnection]);

	const setActive = useCallback(
		(active: boolean): void => {
			// ✅ FIX: Сохраняем время переключения для защиты от автоматических изменений
			userToggledRef.current = Date.now();

			// Сохраняем состояние локально
			setIsActive(active);

			if (active && !autoConnectRef.current && shouldReconnectRef.current) {
				const st = wsRef.current?.readyState;
				if (st !== WebSocket.OPEN && st !== WebSocket.CONNECTING) {
					connect();
				}
			}

			if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
				// WebSocket не подключен - сохраняем состояние для применения после подключения
				pendingActiveStateRef.current = active;
				// Не логируем как ошибку, так как это нормальное поведение при инициализации
				return;
			}

			// WebSocket подключен - отправляем состояние сразу
			pendingActiveStateRef.current = null;
			wsRef.current.send(
				JSON.stringify({
					type: 'set_active',
					active,
				})
			);
		},
		[connect]
	);

	// ✅ OPTIMIZED: Функция для немедленной отправки батча аудио
	const flushAudioBatch = useCallback((): void => {
		if (audioBatchRef.current.length === 0) return;
		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
		if (!isActive) return;

		// Объединяем все буферы в один для эффективной отправки
		const totalLength = audioBatchRef.current.reduce(
			(acc, buf) => acc + buf.byteLength,
			0
		);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const buffer of audioBatchRef.current) {
			combined.set(new Uint8Array(buffer), offset);
			offset += buffer.byteLength;
		}

		try {
			wsRef.current.send(combined.buffer);
		} catch (err) {
			const error =
				err instanceof Error ? err : new Error('Failed to send audio batch');
			log.error('LiveVoiceWebSocket', 'Failed to send audio batch', error);
		}

		audioBatchRef.current = [];
	}, [isActive]);

	const sendAudio = useCallback(
		(audioBlob: Blob): void => {
			if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
				return;
			}

			if (!isActive) {
				return;
			}

			// ✅ OPTIMIZED: Батчинг аудио для уменьшения количества отправок
			audioBlob
				.arrayBuffer()
				.then((buffer) => {
					if (wsRef.current?.readyState === WebSocket.OPEN && isActive) {
						audioBatchRef.current.push(buffer);

						// Очищаем предыдущий таймаут
						if (audioBatchTimeoutRef.current) {
							clearTimeout(audioBatchTimeoutRef.current);
						}

						// Если накопилось много данных, отправляем сразу
						if (audioBatchRef.current.length >= 3) {
							flushAudioBatch();
						} else {
							// Иначе ждём немного для батчинга
							audioBatchTimeoutRef.current = setTimeout(() => {
								flushAudioBatch();
							}, AUDIO_SEND_TIMEOUT);
						}
					}
				})
				.catch((err) => {
					const error =
						err instanceof Error ? err : new Error('Failed to send audio');
					log.error('LiveVoiceWebSocket', 'Failed to send audio', error);
					setError(error);
					onError?.(error);
				});
		},
		[isActive, onError, flushAudioBatch]
	);

	// Auto-connect on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount/unmount only; connect/disconnect identities change with message handlers and would reconnect too often
	useEffect(() => {
		// ✅ FIX: Подключаемся только при первом монтировании
		if (isInitialMountRef.current) {
			isInitialMountRef.current = false;
			// ✅ FIX: Проверяем флаг перед подключением при монтировании
			// Если переподключения отключены (например, после системной ошибки),
			// не пытаемся подключиться автоматически
			if (shouldReconnectRef.current && autoConnectRef.current) {
				connect();
			}
		}

		return (): void => {
			// ✅ FIX: Отключаемся только при размонтировании компонента
			// НЕ отключаем при каждом изменении зависимостей
			if (!isInitialMountRef.current) {
				disconnect();
			}
		};
		// ✅ FIX: Убираем connect и disconnect из зависимостей - они стабильны благодаря useCallback
		// Это предотвращает бесконечные переподключения при изменении зависимостей
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Только при монтировании/размонтировании

	// ✅ OPTIMIZED: Heartbeat с адаптивным интервалом
	useEffect(() => {
		if (!isConnected) return;

		// Более частый heartbeat когда активен режим
		const heartbeatInterval = isActive ? 15000 : 30000;

		const interval = setInterval((): void => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				wsRef.current.send(JSON.stringify({ type: 'ping' }));
			}
		}, heartbeatInterval);

		return (): void => clearInterval(interval);
	}, [isConnected, isActive]);

	// ✅ NEW: Очистка батча аудио при размонтировании
	useEffect(() => {
		return (): void => {
			if (audioBatchTimeoutRef.current) {
				clearTimeout(audioBatchTimeoutRef.current);
			}
			audioBatchRef.current = [];
		};
	}, []);

	// When settings are saved to server, tell backend to reload so next request uses new settings
	useEffect(() => {
		const handler = (): void => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				wsRef.current.send(JSON.stringify({ type: 'reload_settings' }));
				log.info('LiveVoiceWebSocket', 'Settings saved — sent reload_settings');
			}
		};
		window.addEventListener(LIVE_VOICE_SETTINGS_SAVED_EVENT, handler);
		return (): void =>
			window.removeEventListener(LIVE_VOICE_SETTINGS_SAVED_EVENT, handler);
	}, []);

	// ✅ FIX: Автоматическое переподключение после обновления токена
	useEffect(() => {
		if (!authSession.authenticated) {
			return;
		}

		const handleTokenRefresh = (): void => {
			// Если WebSocket был отключен из-за ошибки 1008, переподключаемся
			if (!isConnected && wsRef.current === null) {
				if (import.meta.env.DEV) {
					log.info(
						'LiveVoiceWebSocket',
						'🔄 Token refreshed, reconnecting WebSocket...'
					);
				}
				reconnectAttemptsRef.current = 0; // Сбрасываем счетчик попыток
				shouldReconnectRef.current = true; // ✅ FIX: Разрешаем переподключение после обновления токена
				lastReconnectAttemptRef.current = 0; // ✅ FIX: Сбрасываем время последней попытки
				connect();
			}
		};

		// Слушаем событие обновления токена (multi-subscriber bus — не перетирает AuthContext)
		const unsubscribeTokenExpired = subscribeTokenExpired((): void => {
			authSession
				.updateToken(70)
				.then((refreshed: boolean) => {
					if (refreshed) {
						handleTokenRefresh();
					}
				})
				.catch((): void => {
					// Refresh token истек - не переподключаемся
				});
		});

		return (): void => {
			unsubscribeTokenExpired();
		};
	}, [isConnected, connect]);

	return {
		isConnected,
		isActive,
		modelsReady,
		connect,
		disconnect,
		setActive,
		sendAudio,
		error,
	};
};
