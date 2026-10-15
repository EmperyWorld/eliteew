// BaseService: for specialized protocols/configs (Empery World, Monitoring, WebSocket).
// All calls to EliteEW REST /api/* MUST go through apiClient or createAPIClient from services/api/client.
// Bearer token source: authSession (OIDC). 401 refresh for main API is owned by api/client.ts.
import axios, {
	AxiosHeaders,
	type AxiosInstance,
	type AxiosResponse,
	type AxiosError,
	type AxiosRequestConfig,
	type RawAxiosRequestHeaders,
} from 'axios';
import {
	type ServiceConfig,
	getServiceConfig,
	buildEndpointUrl,
} from './ServiceConfig';
import { type ServiceLogger, createServiceLogger } from './ServiceLogger';
import {
	ServiceError,
	ServiceErrorFactory,
	ServiceErrorRecovery,
} from './ServiceError';
import authSession from '../authSession';
import { log } from '../../utils/logger';

// Response wrapper для всех API ответов
export interface ServiceResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ServiceError;
	message?: string;
	metadata?: {
		requestId?: string;
		timestamp: string;
		source: string;
		cached?: boolean;
	};
}

// Request context для трекинга операций
export interface RequestContext {
	operation: string;
	requestId: string;
	startTime: number;
	retryAttempt?: number;
	userId?: string;
	sessionId?: string;
}

// Cache interface для результатов
interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

// Abstract base service class
export abstract class BaseService {
	protected readonly config: ServiceConfig;
	protected readonly logger: ServiceLogger;
	protected readonly httpClient: AxiosInstance;
	private readonly cache = new Map<string, CacheEntry<unknown>>();
	private readonly requestQueue = new Map<
		string,
		Promise<AxiosResponse<unknown>>
	>();

	constructor(
		serviceConfigKey: keyof typeof import('./ServiceConfig').SERVICE_CONFIGS
	) {
		// Get service configuration
		this.config = getServiceConfig(serviceConfigKey);

		// Initialize logger
		this.logger = createServiceLogger(this.config.serviceName);

		// Create HTTP client
		this.httpClient = this.createHttpClient();

		// Setup interceptors
		this.setupRequestInterceptors();
		this.setupResponseInterceptors();

		this.logger.info('Service initialized', {
			version: this.config.version,
			environment: this.config.environment,
			baseUrl: this.config.endpoints.baseUrl,
		});
	}

	// Abstract methods that must be implemented
	protected abstract getServiceName(): string;

	// Create configured HTTP client
	private createHttpClient(): AxiosInstance {
		// Debug logging
		if (import.meta.env.DEV) {
			log.info(
				'BaseService',
				`Creating HTTP client for ${this.config.serviceName}`,
				{
					baseURL: this.config.endpoints?.baseUrl,
					timeout: this.config.timeout,
					endpointsExists: !!this.config.endpoints,
					endpointsType: typeof this.config.endpoints,
					configKeys: Object.keys(this.config),
				}
			);
		}

		if (!this.config.endpoints) {
			throw new Error(
				`No endpoints configuration for ${this.config.serviceName}`
			);
		}

		if (!this.config.endpoints.baseUrl) {
			throw new Error(`No baseUrl in endpoints for ${this.config.serviceName}`);
		}

		// ✅ Валидация конфигурации для предотвращения "target must be an object"
		if (
			!this.config.endpoints?.baseUrl ||
			typeof this.config.endpoints.baseUrl !== 'string'
		) {
			throw new Error(
				`Invalid baseUrl for ${this.config.serviceName}: ${this.config.endpoints?.baseUrl}`
			);
		}

		// ✅ ЗАЩИТА: Убираем все undefined значения из конфигурации
		const cleanConfig = {
			baseURL: this.config.endpoints.baseUrl,
			timeout: this.config.timeout || 10000,
			headers: {
				'Content-Type': 'application/json',
				'X-Service-Name': this.config.serviceName || 'Unknown',
				'X-Service-Version': this.config.version || '1.0.0',
				'X-Environment': this.config.environment || 'development',
			},
		};

		// Удаляем все undefined/null значения
		const axiosConfig = Object.fromEntries(
			Object.entries(cleanConfig).filter(([_key, value]) => value != null)
		);

		// 🔒 SECURITY: Force HTTPS for any HTTP URLs
		if (axiosConfig.baseURL && typeof axiosConfig.baseURL === 'string') {
			if (axiosConfig.baseURL.startsWith('http://')) {
				log.warn(
					'BaseService',
					`Converting HTTP baseURL to HTTPS: ${axiosConfig.baseURL}`
				);
				axiosConfig.baseURL = axiosConfig.baseURL.replace(
					'http://',
					'https://'
				);
			}
			if (
				axiosConfig.baseURL.includes('app.eliteew.ru') &&
				axiosConfig.baseURL.includes('http://')
			) {
				log.warn(
					'BaseService',
					`Fixing HTTP URL for app.eliteew.ru: ${axiosConfig.baseURL}`
				);
				axiosConfig.baseURL = axiosConfig.baseURL.replace(
					'http://app.eliteew.ru',
					'https://app.eliteew.ru'
				);
			}
		}

		this.logger.debug('✅ Axios config', { service: this.config.serviceName });

		try {
			const client = axios.create(axiosConfig);
			if (import.meta.env.DEV) {
				log.info(
					'BaseService',
					`Axios client created successfully for ${this.config.serviceName}`
				);
			}
			return client;
		} catch (error) {
			if (import.meta.env.DEV) {
				log.error(
					'BaseService',
					`Failed to create axios client for ${this.config.serviceName}`,
					error instanceof Error ? error : undefined,
					{ raw: error }
				);
			}
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to create HTTP client: ${errorMessage}`);
		}
	}

	// Setup request interceptors
	private setupRequestInterceptors(): void {
		// Helper to ensure HTTPS
		const ensureHttps = (url: string | undefined): string | undefined => {
			if (!url) {
				return url;
			}
			if (url.startsWith('http://')) {
				log.warn('BaseService', `Converting HTTP to HTTPS: ${url}`);
				return url.replace('http://', 'https://');
			}
			if (url.startsWith('//')) {
				return `https:${url}`;
			}
			if (url.includes('app.eliteew.ru') && url.includes('http://')) {
				log.warn('BaseService', `Fixing HTTP URL for app.eliteew.ru: ${url}`);
				return url.replace('http://app.eliteew.ru', 'https://app.eliteew.ru');
			}
			return url;
		};

		this.httpClient.interceptors.request.use(
			(config) => {
				// Ensure HTTPS for all URLs
				if (config.url) {
					const originalUrl = config.url;
					config.url = ensureHttps(config.url);
					if (originalUrl !== config.url) {
						log.warn(
							'BaseService',
							`Fixed URL: ${originalUrl} → ${config.url}`
						);
					}
				}
				if (config.baseURL) {
					const originalBaseURL = config.baseURL;
					config.baseURL = ensureHttps(config.baseURL);
					if (originalBaseURL !== config.baseURL) {
						log.warn(
							'BaseService',
							`Fixed baseURL: ${originalBaseURL} → ${config.baseURL}`
						);
					}
				}

				// Generate request ID
				const requestId = this.generateRequestId();

				// 🔥💎 CRITICAL FIX: Правильная работа с AxiosHeaders
				// НЕ перезаписываем headers - только проверяем что они существуют
				if (!config.headers) {
					// Только если headers совсем нет, создаем пустой объект
					config.headers = new AxiosHeaders();
				}

				// 🔥💎 SAFE HEADERS ASSIGNMENT: Используем безопасный способ
				try {
					if (config.headers && typeof config.headers.set === 'function') {
						// AxiosHeaders object - используем метод set
						config.headers.set('X-Request-ID', requestId);
					} else if (config.headers) {
						const plain = config.headers as RawAxiosRequestHeaders;
						plain['X-Request-ID'] = requestId;
					}
				} catch (error) {
					log.warn(
						'BaseService',
						'Header assignment warning for X-Request-ID',
						error instanceof Error ? error : { raw: error }
					);
				}

				// Add authentication if required
				if (this.config.requiresAuth) {
					const token = this.getAuthToken();
					if (token) {
						try {
							// Убедимся что headers существует как объект
							if (!config.headers) {
								config.headers = new AxiosHeaders();
							}

							// Добавим отладочную информацию
							if (import.meta.env.DEV) {
								log.info(
									'BaseService',
									`${this.config.serviceName}: Adding token to headers (length: ${token.length})`
								);
							}

							if (config.headers && typeof config.headers.set === 'function') {
								config.headers.set('Authorization', `Bearer ${token}`);
							} else if (config.headers) {
								const plain = config.headers as RawAxiosRequestHeaders;
								plain.Authorization = `Bearer ${token}`;
							}

							// Проверим что токен добавился
							const hdrs = AxiosHeaders.from(config.headers);
							const authRaw = hdrs.get('Authorization');
							const authHeader =
								typeof authRaw === 'string' ? authRaw : undefined;
							if (import.meta.env.DEV) {
								log.info(
									'BaseService',
									`${this.config.serviceName}: Authorization header set`,
									{
										preview: authHeader
											? `Bearer [${authHeader.split(' ')[1]?.substring(0, 10)}...]`
											: 'NOT SET',
									}
								);
							}
						} catch (error) {
							if (import.meta.env.DEV) {
								log.error(
									'BaseService',
									`${this.config.serviceName}: Failed to set Authorization header`,
									error instanceof Error ? error : undefined,
									{ raw: error }
								);
							}
						}
					} else {
						if (import.meta.env.DEV) {
							log.warn(
								'BaseService',
								`${this.config.serviceName}: No token available for authenticated request`
							);
						}
					}
				}

				// Log request (only in development)
				if (this.config.enableRequestLogging) {
					this.logger.debug('HTTP Request', {
						method: config.method?.toUpperCase(),
						url: config.url,
						headers: { ...config.headers, Authorization: '[REDACTED]' },
						requestId,
					});
				}

				return config;
			},
			(error: unknown) => {
				const errorObj =
					error instanceof Error ? error : new Error(String(error));
				this.logger.error('Request configuration error', errorObj);
				return Promise.reject(errorObj);
			}
		);
	}

	// Setup response interceptors
	private setupResponseInterceptors(): void {
		this.httpClient.interceptors.response.use(
			(response: AxiosResponse) => {
				// Log successful response (only in development)
				if (this.config.enableRequestLogging) {
					const reqHeaders = response.config.headers;
					const rid = reqHeaders
						? AxiosHeaders.from(reqHeaders).get('X-Request-ID')
						: undefined;
					this.logger.debug('HTTP Response Success', {
						status: response.status,
						url: response.config.url,
						requestId:
							typeof rid === 'string'
								? rid
								: Array.isArray(rid)
									? rid[0]
									: undefined,
					});
				}

				return response;
			},
			async (error: AxiosError) => {
				const errHdrs = error.config?.headers;
				const ridRaw = errHdrs
					? AxiosHeaders.from(errHdrs).get('X-Request-ID')
					: undefined;
				const requestId =
					typeof ridRaw === 'string'
						? ridRaw
						: Array.isArray(ridRaw)
							? ridRaw[0]
							: undefined;

				// 401: reject — OIDC refresh/retry is owned by api/client.ts, not emperyworld_* keys.

				// Create service error
				const serviceError = this.createServiceErrorFromAxiosError(error);

				this.logger.error('HTTP Response Error', serviceError, {
					status: error.response?.status,
					url: error.config?.url,
					requestId,
				});

				return Promise.reject(serviceError);
			}
		);
	}

	// Create service error from axios error
	private createServiceErrorFromAxiosError(error: AxiosError): ServiceError {
		// 🔍 DEBUG: Логируем детали axios ошибки
		log.error(
			'BaseService',
			`Axios error details for ${this.getServiceName()}`,
			undefined,
			{
				message: error.message,
				code: error.code,
				hasResponse: !!error.response,
				hasRequest: !!error.request,
				config: error.config,
				stack: error.stack?.split('\n').slice(0, 3), // первые 3 строки stack trace
			}
		);

		if (error.response) {
			return ServiceErrorFactory.httpError(
				this.getServiceName(),
				error.config?.url || 'unknown',
				error.response.status,
				error.config?.url || '',
				error.response.data
			);
		} else if (error.request) {
			return ServiceErrorFactory.networkError(
				this.getServiceName(),
				error.config?.url || 'unknown',
				error
			);
		} else {
			// 🔍 DEBUG: Особое внимание к config errors
			log.error(
				'BaseService',
				`CONFIG ERROR for ${this.getServiceName()}`,
				undefined,
				{
					errorMessage: error.message,
					errorCode: error.code,
					configExists: !!error.config,
					configUrl: error.config?.url,
					configMethod: error.config?.method,
					configData: error.config?.data,
				}
			);

			return ServiceErrorFactory.configError(
				this.getServiceName(),
				'request_config',
				error.message
			);
		}
	}

	// Generate unique request ID
	protected generateRequestId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substr(2, 9);
		return `REQ_${this.getServiceName()}_${timestamp}_${random}`.toUpperCase();
	}

	// 🔐 Get authentication token from auth session facade
	private getAuthToken(): string | null {
		try {
			// Get token from auth session facade
			if (authSession.token) {
				if (import.meta.env.DEV) {
					log.info('BaseService', 'Using auth session token');
				}
				return authSession.token;
			}

			if (import.meta.env.DEV) {
				log.warn('BaseService', 'No auth token available from session');
			}
			return null;
		} catch (error: unknown) {
			if (import.meta.env.DEV) {
				log.error(
					'BaseService',
					'Error getting auth token',
					error instanceof Error ? error : undefined,
					error instanceof Error ? undefined : { raw: error }
				);
			}
			return null;
		}
	}

	// Protected method to make HTTP requests with retry logic
	protected async request<T = unknown>(
		operation: string,
		config: AxiosRequestConfig,
		options: {
			retryable?: boolean;
			maxRetries?: number;
			cacheable?: boolean;
			cacheKey?: string;
		} = {}
	): Promise<ServiceResponse<T>> {
		const opLogger = this.logger.operation(operation);
		const requestId = this.generateRequestId();

		const context: RequestContext = {
			operation,
			requestId,
			startTime: Date.now(),
		};

		try {
			opLogger.info('Starting operation', {
				requestId,
				config: { ...config, data: '[REDACTED]' },
			});

			// Check cache first
			if (options.cacheable && options.cacheKey) {
				const cached = this.getFromCache<T>(options.cacheKey);
				if (cached) {
					opLogger.info('Cache hit', { requestId, cacheKey: options.cacheKey });
					return {
						success: true,
						data: cached,
						metadata: {
							requestId,
							timestamp: new Date().toISOString(),
							source: this.getServiceName(),
							cached: true,
						},
					};
				}
			}

			// Check for duplicate requests
			const requestKey = `${operation}_${JSON.stringify(config)}`;
			if (this.requestQueue.has(requestKey)) {
				opLogger.info('Duplicate request detected, waiting for original', {
					requestId,
				});
				const pending = this.requestQueue.get(requestKey);
				if (pending) {
					const response = await pending;
					return {
						success: true,
						data: response.data as T,
						metadata: {
							requestId,
							timestamp: new Date().toISOString(),
							source: this.getServiceName(),
							cached: false,
						},
					};
				}
			}

			// Debug logging for config
			if (import.meta.env.DEV) {
				log.info(
					'BaseService',
					`AXIOS CONFIG DEBUG for ${this.getServiceName()}`,
					{
						operation,
						configType: typeof config,
						configKeys: Object.keys(config || {}),
						method: config?.method,
						url: config?.url,
						baseURL: this.httpClient?.defaults?.baseURL,
						fullConfig: config,
						httpClientExists: !!this.httpClient,
					}
				);
			}

			// 🔥💎 ULTRATHINK VALIDATION: Глубокая проверка config
			if (!config || typeof config !== 'object') {
				throw new Error(
					`Invalid config object for ${this.getServiceName()}: ${typeof config}`
				);
			}

			// 🔍 DEBUG: Логируем проблемные случаи
			if (config.params && typeof config.params !== 'object') {
				log.error(
					'BaseService',
					`Invalid params in config for ${this.getServiceName()}`,
					undefined,
					{
						paramsType: typeof config.params,
						paramsValue: config.params,
						config: JSON.stringify(config, null, 2),
					}
				);
				// Исправляем params если они неправильные
				config.params = {};
			}

			const cleanConfig: AxiosRequestConfig = {};

			// Безопасно копируем только нужные поля
			if (config.method) {
				cleanConfig.method = config.method;
			}
			if (config.url) {
				cleanConfig.url = config.url;
			}
			if (config.baseURL) {
				cleanConfig.baseURL = config.baseURL;
			}
			if (config.timeout !== undefined) {
				cleanConfig.timeout = config.timeout;
			}

			// Безопасно копируем params
			if (
				config.params &&
				typeof config.params === 'object' &&
				config.params !== null
			) {
				cleanConfig.params = { ...config.params };
			}

			// Безопасно копируем headers
			if (
				config.headers &&
				typeof config.headers === 'object' &&
				config.headers !== null
			) {
				cleanConfig.headers = AxiosHeaders.from(config.headers as AxiosHeaders);
			}

			// Копируем другие safe поля
			if (config.data !== undefined) {
				cleanConfig.data = config.data;
			}
			if (config.responseType) {
				cleanConfig.responseType = config.responseType;
			}
			if (config.validateStatus) {
				cleanConfig.validateStatus = config.validateStatus;
			}

			// Execute request with retry logic
			const requestPromise = (
				options.retryable
					? ServiceErrorRecovery.withRetry(
							() => this.httpClient.request<T>(cleanConfig),
							context,
							options.maxRetries || this.config.retryAttempts,
							this.config.retryDelay
						)
					: this.httpClient.request<T>(cleanConfig)
			) as Promise<AxiosResponse<unknown>>;

			// Store in request queue
			this.requestQueue.set(requestKey, requestPromise);

			const response = await requestPromise;

			// Remove from request queue
			this.requestQueue.delete(requestKey);

			// Cache response if needed
			if (options.cacheable && options.cacheKey && response.data) {
				this.setCache(options.cacheKey, response.data as T);
			}

			const serviceResponse: ServiceResponse<T> = {
				success: true,
				data: response.data as T,
				metadata: {
					requestId,
					timestamp: new Date().toISOString(),
					source: this.getServiceName(),
					cached: false,
				},
			};

			opLogger.success('Operation completed', {
				requestId,
				status: response.status,
				dataSize: JSON.stringify(response.data || {}).length,
			});

			return serviceResponse;
		} catch (error) {
			this.requestQueue.delete(`${operation}_${JSON.stringify(config)}`);

			const serviceError =
				error instanceof ServiceError
					? error
					: ServiceErrorFactory.networkError(
							this.getServiceName(),
							operation,
							error as Error
						);

			opLogger.failure('Operation failed', serviceError, { requestId });

			return {
				success: false,
				error: serviceError,
				message: serviceError.getUserMessage(),
				metadata: {
					requestId,
					timestamp: new Date().toISOString(),
					source: this.getServiceName(),
				},
			};
		}
	}

	// Helper method to build endpoint URLs
	protected buildUrl(endpoint: string): string {
		return buildEndpointUrl(this.config.endpoints, endpoint);
	}

	// Cache management
	private getFromCache<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) {
			return null;
		}

		const now = Date.now();
		if (now - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	private setCache<T>(key: string, data: T): void {
		if (!this.config.cacheEnabled) {
			return;
		}

		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl: this.config.cacheTtl,
		});

		// Clean old cache entries periodically
		if (this.cache.size > 100) {
			this.cleanOldCacheEntries();
		}
	}

	private cleanOldCacheEntries(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl) {
				this.cache.delete(key);
			}
		}
	}

	// Health check method
	public async healthCheck(): Promise<
		ServiceResponse<{ status: string; timestamp: string }>
	> {
		return this.request('healthCheck', {
			method: 'GET',
			url: 'health', // ✅ Относительный путь для axios baseURL - БЕЗ дубликации!
		});
	}

	// Get service configuration
	public getConfig(): ServiceConfig {
		return { ...this.config };
	}

	// Clear service cache
	public clearCache(): void {
		this.cache.clear();
		this.logger.info('Service cache cleared');
	}

	// Get cache stats
	public getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()),
		};
	}
}

export default BaseService;
