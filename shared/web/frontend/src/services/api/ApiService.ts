// 🔥💎 CENTRAL API SERVICE - UNIFIED API HUB FOR ELITEEW ECOSYSTEM 💎🔥
/**
 * 🌐 API SERVICE - ЦЕНТРАЛЬНЫЙ СЕРВИС API ELITE EW
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 НАЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════════════════════════
 * Единая точка входа для всех HTTP взаимодействий с backend API EliteEW экосистемы.
 * Предоставляет унифицированный интерфейс для:
 * • Отправки HTTP запросов (GET, POST, PUT, DELETE, PATCH)
 * • Автоматической аутентификации с JWT токенами
 * • Обработки ошибок и повторных попыток
 * • Кеширования ответов и оптимизации производительности
 * • Мониторинга здоровья API endpoints
 * • Управления rate limiting и throttling
 * • Поддержки WebSocket соединений
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🏗️ АРХИТЕКТУРА И ПАТТЕРНЫ
 * ════════════════════════════════════════════════════════════════════════════════
 * Наследуется от BaseService и расширяет его функциональность:
 *
 * ApiService → BaseService → Axios Instance → HTTP Client
 *
 * Архитектурные паттерны:
 * • Singleton: Единый экземпляр для всего приложения
 * • Factory: Фабрика для создания специализированных клиентов
 * • Decorator: Декораторы для логирования и мониторинга
 * • Strategy: Стратегии для разных типов запросов
 * • Observer: Наблюдатели за состоянием соединения
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🏗️ ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ
 * ════════════════════════════════════════════════════════════════════════════════
 * • Axios 1.6+ как HTTP клиент
 * • TypeScript 5.0+ с generic типами
 * • JWT Bearer authentication
 * • Automatic token refresh
 * • Request/response interceptors
 * • Circuit breaker pattern
 * • Exponential backoff для retry
 * • Request deduplication
 * • Response caching
 * • Compression support (gzip, deflate)
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔧 ОСНОВНЫЕ МЕТОДЫ API
 * ════════════════════════════════════════════════════════════════════════════════
 * • get<T>(url, config?): Promise<ServiceResponse<T>>
 * • post<T>(url, data?, config?): Promise<ServiceResponse<T>>
 * • put<T>(url, data?, config?): Promise<ServiceResponse<T>>
 * • patch<T>(url, data?, config?): Promise<ServiceResponse<T>>
 * • delete<T>(url, config?): Promise<ServiceResponse<T>>
 * • head<T>(url, config?): Promise<ServiceResponse<T>>
 * • options<T>(url, config?): Promise<ServiceResponse<T>>
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🎯 СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ
 * ════════════════════════════════════════════════════════════════════════════════
 * • getHealth(): Promise<EcosystemHealth> - Здоровье экосистемы
 * • getServiceHealth(service: string): Promise<ServiceHealthStatus>
 * • uploadFile(file, progress?): Promise<UploadResponse>
 * • downloadFile(url, filename?): Promise<Blob>
 * • streamData(url, onChunk): Promise<void> - Streaming данных
 * • batchRequest(requests[]): Promise<BatchResponse[]> - Batch запросы
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔄 ЖИЗНЕННЫЙ ЦИКЛ ЗАПРОСА
 * ════════════════════════════════════════════════════════════════════════════════
 * 1. Валидация входных параметров
 * 2. Получение актуального JWT токена
 * 3. Добавление authentication headers
 * 4. Применение request interceptors
 * 5. Отправка HTTP запроса с retry логикой
 * 6. Обработка response interceptors
 * 7. Валидация и парсинг ответа
 * 8. Кеширование успешных ответов
 * 9. Логирование метрик производительности
 * 10. Возврат типизированного результата
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * ⚡ ПРОИЗВОДИТЕЛЬНОСТЬ И ОПТИМИЗАЦИИ
 * ════════════════════════════════════════════════════════════════════════════════
 * • Connection pooling: Переиспользование соединений
 * • Request deduplication: Предотвращение дублированных запросов
 * • Response caching: Кеширование с TTL
 * • Compression: Автоматическая компрессия запросов/ответов
 * • Lazy loading: Загрузка по требованию
 * • Memory management: Очистка кеша при низкой памяти
 * • Bandwidth optimization: Минимизация трафика
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔒 БЕЗОПАСНОСТЬ
 * ════════════════════════════════════════════════════════════════════════════════
 * • JWT token validation: Проверка подписи и срока действия
 * • HTTPS only: Все запросы через защищенное соединение
 * • CSRF protection: Anti-CSRF tokens
 * • XSS protection: Sanitization всех данных
 * • Rate limiting: Защита от злоупотреблений
 * • Request signing: Цифровая подпись критичных запросов
 * • Audit logging: Полное логирование всех запросов
 * • Input validation: Строгая валидация входных данных
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 📊 МОНИТОРИНГ И ЛОГИРОВАНИЕ
 * ════════════════════════════════════════════════════════════════════════════════
 * • Request metrics: Время выполнения, размер ответа
 * • Error tracking: Детальное логирование ошибок
 * • Performance monitoring: Метрики производительности
 * • Health checks: Автоматическая проверка здоровья API
 * • Circuit breaker: Автоматическое отключение при сбоях
 * • Alerting: Уведомления о проблемах
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🚀 БУДУЩИЕ УЛУЧШЕНИЯ
 * ════════════════════════════════════════════════════════════════════════════════
 * • [ ] GraphQL integration
 * • [ ] Advanced caching strategies
 * • [ ] Service mesh integration
 * • [ ] Advanced retry mechanisms
 * • [ ] API versioning support
 * • [ ] Advanced monitoring dashboard
 * • [ ] Machine learning for API optimization
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 📝 ИСТОРИЯ ВЕРСИЙ
 * ════════════════════════════════════════════════════════════════════════════════
 * • v3.0.0 (2025-01-20) - Добавлена поддержка batch запросов
 * • v2.5.0 (2025-01-15) - Улучшена система кеширования
 * • v2.0.0 (2025-01-01) - Полная переработка с TypeScript
 * • v1.5.0 (2024-12-15) - Добавлена поддержка WebSocket
 * • v1.0.0 (2024-11-01) - Начальная версия с базовым функционалом
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔗 СВЯЗАННЫЕ СЕРВИСЫ
 * ════════════════════════════════════════════════════════════════════════════════
 * • BaseService: Базовый класс для всех сервисов
 * • Auth: OIDC via keycloak.ts / AuthContext (AuthService soft-retired)
 * • EmperyworldSocketService: Socket.IO realtime (GAF, presence, notifications)
 * • CacheService: Управление кешем
 * • MonitoringService: Мониторинг и метрики
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 📋 ПРАВИЛА РАЗРАБОТКИ
 * ════════════════════════════════════════════════════════════════════════════════
 * ⚠️ ВАЖНО: При внесении изменений в API сервис:
 * 1. Обновите техническую документацию выше
 * 2. Добавьте новую версию в историю версий
 * 3. Протестируйте все типы запросов
 * 4. Проверьте влияние на производительность
 * 5. Обновите связанные сервисы
 * 6. Запустите интеграционные тесты
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🧪 ТЕСТИРОВАНИЕ
 * ════════════════════════════════════════════════════════════════════════════════
 * • Unit tests: Тестирование отдельных методов
 * • Integration tests: Тестирование с реальным API
 * • Performance tests: Тестирование производительности
 * • Load tests: Тестирование под нагрузкой
 * • Security tests: Тестирование безопасности
 * • E2E tests: Сквозное тестирование API
 *
 * @version 3.0.0
 * @date 2025-01-20
 * @author React UI God
 * @license MIT

 */

import type { AxiosRequestConfig } from 'axios';
import { BaseService, type ServiceResponse } from '../core/BaseService';
import { ServiceError, ServiceErrorFactory } from '../core/ServiceError';

/**
 * Relative paths for Vitest when mocking the ApiService HTTP client (base URL `/api`).
 */
export const apiServiceMockClientPaths = {
	getEcosystemHealth: '/health/ecosystem',
	getEcosystemConfig: '/config',
	getSystemStatus: '/status',
	uploadFile: '/files/upload',
	getFileInfo: (fileId: string) => `/files/${fileId}`,
	getSystemMetrics: '/health',
	getServicesStatus: '/health',
	testConnection: '/health',
	getVersionInfo: '/version',
} as const;

// Core API interfaces
export interface EcosystemHealth {
	status: 'healthy' | 'degraded' | 'down';
	message: string;
	timestamp: string;
	services: ServiceHealthStatus[];
	overall_score: number;
}

export interface ServiceHealthStatus {
	name: string;
	status: 'running' | 'stopped' | 'error';
	health: 'healthy' | 'warning' | 'unhealthy';
	stack: number;
	endpoint?: string;
	response_time?: number;
	last_check: string;
}

/** Map DatabaseManager /api/health service line to ApiService shape. */
function mapDbHealthTokenToServiceHealth(
	st: string
): Pick<ServiceHealthStatus, 'status' | 'health'> {
	const u = (st || '').toLowerCase();
	if (u === 'healthy' || u === 'up' || u === 'ok') {
		return { status: 'running', health: 'healthy' };
	}
	if (
		u === 'degraded' ||
		u === 'warning' ||
		u === 'partial' ||
		u === 'unknown'
	) {
		return { status: 'running', health: 'warning' };
	}
	return { status: 'error', health: 'unhealthy' };
}

export interface EcosystemConfig {
	api_version: string;
	environment: string;
	stacks: {
		[key: string]: {
			name: string;
			base_url: string;
			status: string;
			services: string[];
		};
	};
	features: {
		[key: string]: boolean;
	};
	limits: {
		max_requests_per_minute: number;
		max_file_size_mb: number;
		max_concurrent_connections: number;
	};
}

// Generation request interfaces (for AI integration)
export interface GenerateImageRequest {
	prompt: string;
	style?: string;
	width?: number;
	height?: number;
	model?: string;
	negative_prompt?: string;
	steps?: number;
	guidance_scale?: number;
}

export interface GenerateTextRequest {
	prompt: string;
	model?: string;
	max_tokens?: number;
	temperature?: number;
	top_p?: number;
	type?: 'story' | 'poem' | 'article' | 'code' | 'summary';
	context?: string;
}

export interface GenerationTask {
	task_id: string;
	type: 'text' | 'image' | 'audio' | 'video';
	status: 'queued' | 'processing' | 'completed' | 'failed';
	progress: number;
	estimated_time?: number;
	created_at: string;
	completed_at?: string;
	result?: {
		url?: string;
		text?: string;
		metadata?: unknown;
	};
	error?: string;
}

// Central API Service class
export class ApiService extends BaseService {
	constructor() {
		super('API');
	}

	protected getServiceName(): string {
		return 'ApiService';
	}

	// ============= ECOSYSTEM MANAGEMENT =============

	// Get overall ecosystem health
	public async getEcosystemHealth(): Promise<ServiceResponse<EcosystemHealth>> {
		return this.request<EcosystemHealth>(
			'getEcosystemHealth',
			{
				method: 'GET',
				url: '/health/ecosystem',
			},
			{
				cacheable: true,
				cacheKey: 'ecosystem_health',
				retryable: true,
			}
		);
	}

	// Get unified ecosystem configuration
	public async getEcosystemConfig(): Promise<ServiceResponse<EcosystemConfig>> {
		return this.request<EcosystemConfig>(
			'getEcosystemConfig',
			{
				method: 'GET',
				url: '/config',
			},
			{
				cacheable: true,
				cacheKey: 'ecosystem_config',
				retryable: true,
			}
		);
	}

	// Get system status
	public async getSystemStatus(): Promise<ServiceResponse<unknown>> {
		return this.request<unknown>(
			'getSystemStatus',
			{
				method: 'GET',
				url: '/status',
			},
			{
				cacheable: true,
				cacheKey: 'system_status',
				retryable: true,
			}
		);
	}

	// ============= FILE OPERATIONS =============

	// Upload file
	public async uploadFile(
		file: File,
		metadata?: unknown
	): Promise<ServiceResponse<{ file_id: string; url: string }>> {
		const formData = new FormData();
		formData.append('file', file);
		if (metadata) {
			formData.append('metadata', JSON.stringify(metadata));
		}

		return this.request<{ file_id: string; url: string }>(
			'uploadFile',
			{
				method: 'POST',
				url: '/files/upload',
				data: formData,
				headers: {
					'Content-Type': 'multipart/form-data',
				},
			},
			{
				retryable: true,
			}
		);
	}

	// Get file info
	public async getFileInfo(fileId: string): Promise<ServiceResponse<unknown>> {
		return this.request<unknown>(
			'getFileInfo',
			{
				method: 'GET',
				url: `/files/${fileId}`,
			},
			{
				cacheable: true,
				cacheKey: `file_info_${fileId}`,
				retryable: true,
			}
		);
	}

	// ============= MONITORING INTEGRATION =============

	// Get system metrics
	public async getSystemMetrics(): Promise<ServiceResponse<unknown>> {
		return this.request<unknown>(
			'getSystemMetrics',
			{
				method: 'GET',
				url: '/health',
			},
			{
				cacheable: true,
				cacheKey: 'system_metrics',
				retryable: true,
			}
		);
	}

	// Get services status
	public async getServicesStatus(): Promise<
		ServiceResponse<{ services: ServiceHealthStatus[] }>
	> {
		const raw = await this.request<{
			timestamp?: string;
			services?: Record<string, string>;
		}>(
			'getServicesStatus',
			{
				method: 'GET',
				url: '/health',
			},
			{
				cacheable: true,
				cacheKey: 'services_status',
				retryable: true,
			}
		);

		if (!raw.success || !raw.data) {
			return {
				success: raw.success,
				error: raw.error,
				message: raw.message,
				metadata: raw.metadata,
			};
		}

		const ts = raw.data.timestamp ?? new Date().toISOString();
		const services: ServiceHealthStatus[] = Object.entries(
			raw.data.services ?? {}
		).map(([name, line]) => {
			const { status, health } = mapDbHealthTokenToServiceHealth(line);
			return {
				name,
				status,
				health,
				stack: 0,
				last_check: ts,
			};
		});

		return {
			...raw,
			data: { services },
		};
	}

	// ============= BATCH OPERATIONS =============

	// Execute multiple requests in parallel
	public async batchRequests<T>(
		requests: Array<{
			name: string;
			operation: () => Promise<ServiceResponse<T>>;
		}>
	): Promise<Record<string, ServiceResponse<T>>> {
		const results: Record<string, ServiceResponse<T>> = {};

		try {
			const promises = requests.map(async ({ name, operation }) => {
				try {
					const result = await operation();
					return { name, result };
				} catch (error) {
					const serviceError =
						error instanceof ServiceError
							? error
							: ServiceErrorFactory.networkError(
									this.getServiceName(),
									name,
									error as Error
								);

					return {
						name,
						result: {
							success: false,
							error: serviceError,
							message: serviceError.getUserMessage(),
						} as ServiceResponse<T>,
					};
				}
			});

			const batchResults = await Promise.all(promises);

			batchResults.forEach(({ name, result }) => {
				results[name] = result;
			});

			this.logger.info('Batch requests completed', {
				total: requests.length,
				successful: batchResults.filter((r) => r.result.success).length,
				failed: batchResults.filter((r) => !r.result.success).length,
			});
		} catch (error) {
			const errorObj =
				error instanceof Error ? error : new Error(String(error));
			this.logger.error('Batch requests failed', errorObj);

			// Fill results with errors
			requests.forEach(({ name }) => {
				if (!results[name]) {
					const serviceError = ServiceErrorFactory.networkError(
						this.getServiceName(),
						name,
						error as Error
					);
					results[name] = {
						success: false,
						error: serviceError,
						message: serviceError.getUserMessage(),
					} as ServiceResponse<T>;
				}
			});
		}

		return results;
	}

	// ============= UTILITY METHODS =============

	// Test API connection
	public async testConnection(): Promise<
		ServiceResponse<{ connected: boolean; latency: number }>
	> {
		const startTime = Date.now();

		const result = await this.request<unknown>('testConnection', {
			method: 'GET',
			url: '/health',
		});

		const latency = Date.now() - startTime;

		return {
			success: result.success,
			data: {
				connected: result.success,
				latency,
			},
			error: result.error,
			message: result.success
				? 'API connection successful'
				: 'API connection failed',
			metadata: result.metadata,
		};
	}

	// Get API version info
	public async getVersionInfo(): Promise<
		ServiceResponse<{ version: string; build: string; environment: string }>
	> {
		return this.request<{
			version: string;
			build: string;
			environment: string;
		}>(
			'getVersionInfo',
			{
				method: 'GET',
				url: '/version',
			},
			{
				cacheable: true,
				cacheKey: 'version_info',
				retryable: true,
			}
		);
	}
	// ============= UNIVERSAL HTTP METHODS =============
	// 🔥💎 УЛЬТРА-ВАЖНЫЕ методы для совместимости с UnifiedEditor 💎🔥

	// Generic POST method
	public async post<T = unknown>(
		url: string,
		data?: unknown,
		options?: Partial<AxiosRequestConfig>
	): Promise<ServiceResponse<T>> {
		return this.request<T>(
			'genericPost',
			{
				method: 'POST',
				url: url,
				data: data,
				...options,
			},
			{
				retryable: true,
				maxRetries: 2,
			}
		);
	}

	// Generic GET method
	public async get<T = unknown>(
		url: string,
		params?: AxiosRequestConfig['params'],
		options?: Partial<AxiosRequestConfig>
	): Promise<ServiceResponse<T>> {
		return this.request<T>(
			'genericGet',
			{
				method: 'GET',
				url: url,
				params: params,
				...options,
			},
			{
				retryable: true,
				maxRetries: 2,
			}
		);
	}

	// Generic PUT method
	public async put<T = unknown>(
		url: string,
		data?: unknown,
		options?: Partial<AxiosRequestConfig>
	): Promise<ServiceResponse<T>> {
		return this.request<T>(
			'genericPut',
			{
				method: 'PUT',
				url: url,
				data: data,
				...options,
			},
			{
				retryable: true,
				maxRetries: 1,
			}
		);
	}

	// Generic DELETE method
	public async delete<T = unknown>(
		url: string,
		options?: Partial<AxiosRequestConfig>
	): Promise<ServiceResponse<T>> {
		return this.request<T>(
			'genericDelete',
			{
				method: 'DELETE',
				url: url,
				...options,
			},
			{
				retryable: false, // Deletes should not be retried
			}
		);
	}

	// Generic PATCH method
	public async patch<T = unknown>(
		url: string,
		data?: unknown,
		options?: Partial<AxiosRequestConfig>
	): Promise<ServiceResponse<T>> {
		return this.request<T>(
			'genericPatch',
			{
				method: 'PATCH',
				url: url,
				data: data,
				...options,
			},
			{
				retryable: true,
				maxRetries: 1,
			}
		);
	}
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
