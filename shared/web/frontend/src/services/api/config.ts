export type ConfigItem = {
	id: string;
	namespace: string;
	key: string;
	type: string;
	valueJson: unknown;
	description?: string | null;
	updatedBy?: string | null;
	updatedAt: string;
};

export async function fetchConfig(namespace = 'site'): Promise<ConfigItem[]> {
	const { adminApiClient } = await import('./client');
	const { data } = await adminApiClient.get<{
		namespace: string;
		items: ConfigItem[];
	}>('/admin/config', {
		params: { namespace },
	});
	return data.items;
}

export async function upsertConfigItems(
	namespace: string,
	items: Array<{
		key: string;
		type: string;
		value: unknown;
		description?: string;
	}>
): Promise<ConfigItem[]> {
	const { adminApiClient } = await import('./client');
	const results: ConfigItem[] = [];
	for (const item of items) {
		const { data } = await adminApiClient.put<{
			success: boolean;
			item: ConfigItem;
		}>('/admin/config', {
			namespace,
			key: item.key,
			type: item.type,
			value: item.value,
			description: item.description,
		});
		results.push(data.item);
	}
	return results;
}

export async function fetchFeatureFlags() {
	const { adminApiClient } = await import('./client');
	const { data } = await adminApiClient.get('/admin/flags');
	return data as Array<{
		id: string;
		key: string;
		isEnabled: boolean;
		scope?: string | null;
		rollout?: number | null;
		description?: string | null;
	}>;
}

export async function upsertFeatureFlags(
	items: Array<{
		key: string;
		isEnabled?: boolean;
		scope?: string;
		rollout?: number | null;
		description?: string;
	}>
) {
	const { adminApiClient } = await import('./client');
	const { data } = await adminApiClient.put('/admin/flags', { items });
	return data.items as Array<{
		id: string;
		key: string;
		isEnabled: boolean;
		scope?: string | null;
		rollout?: number | null;
		description?: string | null;
	}>;
}
/**
 * @fileoverview API Client Configuration
 *
 * @role API Configuration Layer
 *   - Primary responsibility: Centralized configuration for API, React Query keys, error messages
 *   - Used by: All API services and hooks
 *   - API endpoints: Configuration for base URLs, timeouts, retry logic
 *
 * @architecture
 *   - Layer: Configuration / Constants
 *   - Pattern: Centralized config with type-safe query key factories
 *   - Integration: React Query v5 query/mutation keys, Socket.IO config
 *
 * @status
 *   - TypeScript errors fixed: 4 (added competitorDetail query key, competitor messages)
 *   - Last audit: 2025-10-23 - Agent 1 (API Hooks & Services)
 *
 * @version 2.0.0 - React Query v5 Integration
 * @date 2025-10-13
 */

import { ELITEEW_SOCKET_IO_TRANSPORTS } from '../auth/socketIoClientPolicy';

// Tauri shell or FoFline L3 custom-protocol pack (opaque origin — need absolute API).
const isTauri =
	typeof window !== 'undefined' &&
	(window.location.protocol === 'tauri:' ||
		window.location.protocol === 'fofline-spa:' ||
		(window as Window & { __TAURI__?: unknown }).__TAURI__ !== undefined);

// Базовый URL для API - в Tauri используем абсолютный URL
const getBaseURL = (): string => {
	if (isTauri) {
		return import.meta.env.VITE_API_URL || 'https://app.eliteew.ru';
	}
	return '';
};

const getUgsBaseURL = (): string => {
	if (isTauri) {
		const base = import.meta.env.VITE_API_URL || 'https://app.eliteew.ru';
		return `${base}/api/v1/ugs`;
	}
	return '/api/v1/ugs';
};

function readTimeoutMs(): number {
	const raw = import.meta.env.VITE_API_TIMEOUT_MS;
	if (raw === undefined || raw === '') {
		return 30000;
	}
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : 30000;
}

function readLongTimeoutMs(): number {
	const raw = import.meta.env.VITE_API_LONG_TIMEOUT_MS;
	if (raw === undefined || raw === '') {
		return 120000;
	}
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : 120000;
}

/** Multipart uploads (GAF, Content Manager, avatar). 0 = no axios cap (nginx/API still limit). */
function readUploadTimeoutMs(): number {
	const raw = import.meta.env.VITE_API_UPLOAD_TIMEOUT_MS;
	if (raw === undefined || raw === '') {
		return 5 * 60 * 1000;
	}
	if (raw === '0') {
		return 0;
	}
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : 5 * 60 * 1000;
}

/** Default multipart upload timeout (ms); same as [API_CONFIG.uploadTimeout]. */
export const FILE_UPLOAD_TIMEOUT_MS = readUploadTimeoutMs();

/**
 * Main API base URL for the default apiClient.
 * In browser: use window.location.origin when on HTTPS or app.eliteew.ru to avoid Mixed Content
 * (relative paths could otherwise resolve to http when e.g. env or proxy is wrong).
 * In Tauri uses full origin. All requests to /api/* must go through apiClient or createAPIClient from services/api/client.
 */
export const getMainApiBaseURL = (): string => {
	const envOverride = import.meta.env.VITE_API_BASE_URL;
	if (
		typeof envOverride === 'string' &&
		envOverride.trim().length > 0 &&
		/^https?:\/\//i.test(envOverride.trim())
	) {
		const u = envOverride.trim();
		return u.startsWith('http://') ? u.replace('http://', 'https://') : u;
	}
	if (isTauri) {
		const url = import.meta.env.VITE_API_URL || 'https://app.eliteew.ru';
		return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
	}
	if (typeof window !== 'undefined') {
		const origin = window.location.origin;
		if (
			window.location.protocol === 'https:' ||
			window.location.hostname === 'app.eliteew.ru'
		) {
			return origin;
		}
	}
	return '';
};

/**
 * Per-request Axios `baseURL` often overrides the client default with a relative
 * `/api/v1` (desktop hydrate, shell-bootstrap, …). On `fofline-spa:` / Tauri the
 * relative base would resolve against the custom scheme and never reach stack0 —
 * prepend the absolute main API origin when one is known.
 */
export function resolveAbsoluteApiBaseURL(
	baseURL: string | null | undefined
): string {
	const raw = (baseURL ?? '').trim();
	const main = getMainApiBaseURL().replace(/\/$/, '');
	if (!raw) {
		return main;
	}
	if (/^https?:\/\//i.test(raw)) {
		return raw.startsWith('http://') ? raw.replace('http://', 'https://') : raw;
	}
	if (!main) {
		return raw.startsWith('/') ? raw : `/${raw}`;
	}
	if (raw.startsWith('/')) {
		return `${main}${raw}`;
	}
	return `${main}/${raw}`;
}

/**
 * Engine.IO `io()` origin. Must be `http(s)`, never `ws://` and never an opaque
 * custom scheme. EmpiierOS does not scheme-proxy `/socket.io`.
 *
 * Opaque FoFline (`fofline-spa:` / origin `null`) speaks `https://app.eliteew.ru`.
 * Browser `*.eliteew.ru` stays `location.origin`. Other hosts (Tauri `tauri:`,
 * dev) keep `VITE_WS_ORIGIN` / `VITE_API_ORIGIN` / `location.origin`.
 */
export const FOFLINE_SOCKET_IO_HTTP_ORIGIN = 'https://app.eliteew.ru';

export function isOpaqueFoflineSocketOrigin(loc: {
	protocol: string;
	origin: string;
}): boolean {
	if (loc.protocol === 'fofline-spa:') {
		return true;
	}
	if (
		loc.origin === 'null' &&
		loc.protocol !== 'http:' &&
		loc.protocol !== 'https:'
	) {
		return true;
	}
	return false;
}

export function resolveSocketIoHttpOrigin(
	loc?: { protocol: string; origin: string; hostname: string } | null
): string {
	const location =
		loc ?? (typeof window !== 'undefined' ? window.location : null);
	if (!location) {
		const fallback = import.meta.env.VITE_EMPERYWORLD_WS_URL as
			| string
			| undefined;
		return fallback && fallback.trim().length > 0
			? fallback.trim()
			: FOFLINE_SOCKET_IO_HTTP_ORIGIN;
	}
	if (isOpaqueFoflineSocketOrigin(location)) {
		return FOFLINE_SOCKET_IO_HTTP_ORIGIN;
	}
	if (location.hostname.includes('eliteew.ru')) {
		return location.origin;
	}
	const wsOrigin = import.meta.env.VITE_WS_ORIGIN as string | undefined;
	if (typeof wsOrigin === 'string' && wsOrigin.trim().length > 0) {
		return wsOrigin.trim();
	}
	const apiOrigin = import.meta.env.VITE_API_ORIGIN as string | undefined;
	if (typeof apiOrigin === 'string' && apiOrigin.trim().length > 0) {
		return apiOrigin.trim();
	}
	return location.origin;
}

/** Canonical path prefix for Site Studio desktop proxy (must match backend router). */
export const SITE_STUDIO_PROXY_BASE_PATH =
	'/api/v1/desktop/site-studio/proxy' as const;

/**
 * Central API path prefixes. Use these instead of hardcoded paths.
 * All use /api/v1 except PRESENTATIONS_UNIFIED (canonical path for that router).
 */
export const API_PATHS = {
	/**
	 * Legacy / reserved string. There is no unified FastAPI mount at `/api/v1/dashboard`
	 * in the current OpenAPI export; marketing dashboards use `/api/v1/marketing-cabinet/...`.
	 * Still referenced by interceptor tests and historical paths.
	 */
	DASHBOARD: '/api/v1/dashboard',
	PROFILE: '/api/v1/profile',
	CONTENT: '/api/v1/content',
	DESKTOP: '/api/v1',
	EWRP: '/api/v1/ewrp',
	DOC_EDITOR: '/api/v1/doc-editor',
	ELITE_EDITOR: '/api/v1/elite-editor',
	TTS: '/api/v1/tts',
	SITE_STUDIO_PROXY: SITE_STUDIO_PROXY_BASE_PATH,
} as const;

export const API_CONFIG = {
	// Base URLs
	baseURL: getBaseURL(),
	/** Main API base for default apiClient (empty in browser = same-origin full paths) */
	mainApiBaseURL: getMainApiBaseURL(),
	ugsBaseURL: getUgsBaseURL(),
	// WebSocket URL - автоматически определяет ws:// или wss:// в зависимости от протокола страницы
	get wsURL() {
		if (typeof window === 'undefined') {
			return 'ws://localhost:29000';
		}
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const hostname = window.location.hostname;

		// Production: используем тот же домен, что и страница
		if (hostname === 'app.eliteew.ru' || hostname === 'eliteew.ru') {
			// Используем тот же порт, что и основной API (через reverse proxy)
			return `${protocol}//${hostname}${window.location.port ? `:${window.location.port}` : ''}`;
		}

		// Development: порт из env или текущий origin
		const devPort =
			import.meta.env.VITE_WS_PORT || import.meta.env.VITE_API_PORT;
		return devPort
			? `${protocol}//${hostname}:${devPort}`
			: `${protocol}//${hostname}`;
	},

	// Timeouts (milliseconds); override with VITE_API_TIMEOUT_MS / VITE_API_LONG_TIMEOUT_MS / VITE_API_UPLOAD_TIMEOUT_MS
	timeout: readTimeoutMs(),
	longTimeout: readLongTimeoutMs(),
	uploadTimeout: FILE_UPLOAD_TIMEOUT_MS,

	// Retry configuration
	retry: {
		attempts: 3,
		delay: 1000,
		backoffFactor: 2,
	},

	// Cache configuration (React Query)
	cache: {
		staleTime: {
			default: 5 * 60 * 1000, // 5 minutes
			list: 2 * 60 * 1000, // 2 minutes (lists change more often)
			detail: 10 * 60 * 1000, // 10 minutes (details are more stable)
			static: 30 * 60 * 1000, // 30 minutes (rarely changing data)
		},
		cacheTime: 30 * 60 * 1000, // 30 minutes
	},

	// Socket.IO configuration
	socketIO: {
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
		timeout: 20000,
		transports: [...ELITEEW_SOCKET_IO_TRANSPORTS],
	},
} as const;

/**
 * Query Keys Factory
 * Standardized query key generation for React Query
 */
export const QueryKeys = {
	// JTBD Module
	jtbd: {
		all: ['jtbd'] as const,
		projects: () => [...QueryKeys.jtbd.all, 'projects'] as const,
		project: (id: string) => [...QueryKeys.jtbd.projects(), id] as const,
		jobStories: (filters?: Record<string, unknown>) =>
			[...QueryKeys.jtbd.all, 'job-stories', filters] as const,
		jobStory: (id: string) => [...QueryKeys.jtbd.all, 'job-story', id] as const,
		interviews: (projectId?: string) =>
			[...QueryKeys.jtbd.all, 'interviews', projectId] as const,
		clusters: (projectId?: string) =>
			[...QueryKeys.jtbd.all, 'clusters', projectId] as const,
	},

	// Business Analysis Module
	businessAnalysis: {
		all: ['business-analysis'] as const,
		swot: (projectId?: string) =>
			[...QueryKeys.businessAnalysis.all, 'swot', projectId] as const,
		swotDetail: (id: string) =>
			[...QueryKeys.businessAnalysis.all, 'swot', id] as const,
		swotRecommendations: (analysisId: string) =>
			[
				...QueryKeys.businessAnalysis.all,
				'swot-recommendations',
				analysisId,
			] as const,
		porters: (projectId?: string) =>
			[...QueryKeys.businessAnalysis.all, 'porters', projectId] as const,
		portersDetail: (id: string) =>
			[...QueryKeys.businessAnalysis.all, 'porters', id] as const,
		competitors: (projectId?: string) =>
			[...QueryKeys.businessAnalysis.all, 'competitors', projectId] as const,
		competitorDetail: (id: string) =>
			[...QueryKeys.businessAnalysis.all, 'competitor', id] as const,
	},

	// ContentAI Module
	contentAI: {
		all: ['content-ai'] as const,
		content: (filters?: Record<string, unknown>) =>
			[...QueryKeys.contentAI.all, 'content', filters] as const,
		contentItem: (id: string) =>
			[...QueryKeys.contentAI.all, 'content', id] as const,
		sentiment: (contentId: string) =>
			[...QueryKeys.contentAI.all, 'sentiment', contentId] as const,
		topics: (contentId: string) =>
			[...QueryKeys.contentAI.all, 'topics', contentId] as const,
		entities: (contentId: string) =>
			[...QueryKeys.contentAI.all, 'entities', contentId] as const,
	},

	// Tasks (async operations)
	tasks: {
		all: ['tasks'] as const,
		task: (taskId: string) => [...QueryKeys.tasks.all, taskId] as const,
	},
} as const;

/**
 * Mutation Keys Factory
 * Standardized mutation key generation
 */
export const MutationKeys = {
	jtbd: {
		createJobStory: ['jtbd', 'create-job-story'] as const,
		updateJobStory: ['jtbd', 'update-job-story'] as const,
		deleteJobStory: ['jtbd', 'delete-job-story'] as const,
		extractJobs: ['jtbd', 'extract-jobs'] as const,
	},
	businessAnalysis: {
		createSWOT: ['business-analysis', 'create-swot'] as const,
		generateSWOTAI: ['business-analysis', 'generate-swot-ai'] as const,
		extractSWOTFactors: ['business-analysis', 'extract-swot-factors'] as const,
		generateStrategies: ['business-analysis', 'generate-strategies'] as const,
		validateSWOTFactor: ['business-analysis', 'validate-swot-factor'] as const,
		createPorter: ['business-analysis', 'create-porter'] as const,
		generatePorterAI: ['business-analysis', 'generate-porter-ai'] as const,
		createCompetitor: ['business-analysis', 'create-competitor'] as const,
		generateCompetitorReportAI: [
			'business-analysis',
			'generate-competitor-report-ai',
		] as const,
		generateChannelMixAI: [
			'business-analysis',
			'generate-channel-mix-ai',
		] as const,
		generateCustomerInsightsAI: [
			'business-analysis',
			'generate-customer-insights-ai',
		] as const,
		generateFinancialProjectionAI: [
			'business-analysis',
			'generate-financial-projection-ai',
		] as const,
	},
	contentAI: {
		createContent: ['content-ai', 'create-content'] as const,
		analyzeSentiment: ['content-ai', 'analyze-sentiment'] as const,
		extractTopics: ['content-ai', 'extract-topics'] as const,
		batchProcess: ['content-ai', 'batch-process'] as const,
	},
} as const;

/**
 * Error Messages
 * User-friendly error messages for common scenarios
 */
export const ErrorMessages = {
	network: 'Проблема с сетью. Проверьте подключение к интернету.',
	unauthorized: 'Необходима авторизация. Пожалуйста, войдите в систему.',
	forbidden: 'Недостаточно прав доступа.',
	notFound: 'Запрашиваемый ресурс не найден.',
	serverError: 'Ошибка сервера. Попробуйте позже.',
	timeout: 'Превышено время ожидания. Попробуйте еще раз.',
	canceled: 'Запрос отменён.',
	validation: 'Проверьте правильность введенных данных.',
	unknown: 'Произошла неизвестная ошибка.',
} as const;

/**
 * Custom Error Messages for specific operations
 */
export const OperationMessages = {
	jtbd: {
		createSuccess: 'Job Story успешно создан',
		updateSuccess: 'Job Story успешно обновлен',
		deleteSuccess: 'Job Story удален',
		extractStarted: 'Извлечение Job Stories началось. Это займет 30-60 секунд.',
		extractSuccess: 'Job Stories успешно извлечены',
		extractError: 'Ошибка при извлечении Job Stories',
	},
	businessAnalysis: {
		swotCreateSuccess: 'SWOT анализ создан',
		swotGenerateStarted: 'Генерация SWOT анализа началась',
		swotGenerateSuccess: 'SWOT анализ сгенерирован',
		porterCreateSuccess: "Анализ Porter's 5 Forces создан",
		porterGenerateStarted: 'Генерация анализа Портера запущена',
		competitorAddSuccess: 'Конкурент добавлен',
		competitorUpdateSuccess: 'Конкурент обновлен',
		competitorDeleteSuccess: 'Конкурент удален',
		competitorReportGenerateStarted: 'Генерация отчёта по конкуренту запущена',
		channelMixGenerateStarted: 'Генерация Channel Mix плана запущена',
		customerInsightsGenerateStarted: 'Генерация клиентских инсайтов запущена',
		financialProjectionGenerateStarted: 'Финансовый прогноз UGS запущен',
	},
	contentAI: {
		uploadSuccess: 'Документ загружен',
		analyzeStarted: 'Анализ контента начался',
		analyzeSuccess: 'Анализ завершен',
		batchStarted: 'Пакетная обработка началась',
		batchSuccess: 'Пакетная обработка завершена',
	},
} as const;
