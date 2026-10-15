import { log } from './utils/logger';

// Production Configuration - используем относительные пути для оптимизации
const getApiBaseUrl = (): string => {
	const hostname = window.location.hostname;
	const protocol = window.location.protocol;

	// 🔥 Tauri Desktop App - используем реальный API URL
	// В Tauri window.location будет tauri://localhost, нужно использовать внешний API
	if (
		protocol === 'tauri:' ||
		(hostname === 'localhost' && protocol.startsWith('tauri'))
	) {
		// Используем внешний API через домен или localhost с портом
		const apiUrl = import.meta.env.VITE_API_URL || 'https://app.eliteew.ru';
		return apiUrl;
	}

	// 🔥 ПРАВИЛЬНО: Используем относительные пути для production
	// Frontend Nginx проксирует /api/* напрямую на backend через Docker сеть
	// Это быстрее, безопаснее и проще чем через api.eliteew.ru + OAuth2 Proxy
	if (hostname === 'app.eliteew.ru' || hostname === 'eliteew.ru') {
		return ''; // Пустая строка = относительный путь через текущий origin
	}

	// Development mode - используем относительный путь для Vite proxy
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		return ''; // Пустая строка = текущий origin для dev proxy
	}

	// Fallback для других случаев
	return '';
};

const getWsBaseUrl = (): string => {
	const hostname = window.location.hostname;
	const protocol = window.location.protocol;

	// 🔥 Tauri Desktop App - используем реальный WebSocket URL
	if (
		protocol === 'tauri:' ||
		(hostname === 'localhost' && protocol.startsWith('tauri'))
	) {
		// Используем внешний WebSocket через домен
		const wsUrl = import.meta.env.VITE_WS_URL || 'wss://app.eliteew.ru';
		return wsUrl;
	}

	// 🔥 ПРАВИЛЬНО: Используем тот же домен для WebSocket
	// Frontend Nginx проксирует WebSocket напрямую на backend через Docker сеть
	if (hostname === 'app.eliteew.ru' || hostname === 'eliteew.ru') {
		// Используем тот же протокол и домен что и страница
		const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${wsProtocol}//${hostname}${window.location.port ? `:${window.location.port}` : ''}`;
	}

	// Development mode
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		const port = window.location.port;
		return `ws://${hostname}:${port}`;
	}

	// Fallback
	const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${wsProtocol}//${hostname}:${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}`;
};

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

// Экспорт для отдельных сервисов
export const API_ENDPOINTS = {
	EMPERYWORLD: `${API_BASE_URL}/api/emperyworld`,
	CREATIVE: `${API_BASE_URL}/api/creative`,
	/** Client log ingest lives under POST /api/monitoring/logs */
	MONITORING: `${API_BASE_URL}/api/monitoring`,
};

export const WS_ENDPOINTS = {
	/** Socket.IO origin + path; Engine.IO client appends transport query itself. */
	MAIN: `${WS_BASE_URL}/socket.io`,
};

log.info('Config', '✅ КОНФИГУРАЦИЯ ИНИЦИАЛИЗИРОВАНА!');
log.info('Config', `API Base URL: ${API_BASE_URL}`);
log.info('Config', `WebSocket Base URL: ${WS_BASE_URL}`);

// Default Llama model for voice/UI: только build-time env (или пусто — бэкенд подставит из LLAMA_MODEL).
export const DEFAULT_LLAMA_MODEL: string = (
	(import.meta.env.VITE_LLAMA_DEFAULT_MODEL as string | undefined) ?? ''
).trim();
