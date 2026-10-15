export enum ServiceErrorType {
	// Network errors
	NETWORK_ERROR = 'NETWORK_ERROR',
	TIMEOUT = 'TIMEOUT',
	CONNECTION_REFUSED = 'CONNECTION_REFUSED',

	// HTTP errors
	BAD_REQUEST = 'BAD_REQUEST',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
	SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

	// Authentication errors
	TOKEN_EXPIRED = 'TOKEN_EXPIRED',
	TOKEN_INVALID = 'TOKEN_INVALID',
	AUTH_REQUIRED = 'AUTH_REQUIRED',

	// Service-specific errors
	API_ERROR = 'API_ERROR',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',

	// Configuration errors
	CONFIG_ERROR = 'CONFIG_ERROR',
	ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',

	// AI/Generation errors
	AI_MODEL_UNAVAILABLE = 'AI_MODEL_UNAVAILABLE',
	GENERATION_FAILED = 'GENERATION_FAILED',
	GPU_MEMORY_ERROR = 'GPU_MEMORY_ERROR',

	// WebSocket errors
	WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
	CONNECTION_LOST = 'CONNECTION_LOST',

	// Unknown/Generic
	UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export enum ServiceErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical',
}

export interface ServiceErrorContext {
	serviceName: string;
	operation: string;
	endpoint?: string;
	requestData?: unknown;
	responseStatus?: number;
	responseData?: unknown;
	timestamp: string;
	userId?: string;
	sessionId?: string;
	stackTrace?: string;
	retryAttempt?: number;
	totalRetryAttempts?: number;
}

export interface ServiceErrorRecoveryStrategy {
	canRetry: boolean;
	retryDelay?: number;
	maxRetries?: number;
	fallbackAction?: () => Promise<unknown>;
	userMessage?: string;
	shouldLogout?: boolean;
}

export class ServiceError extends Error {
	public readonly type: ServiceErrorType;
	public readonly severity: ServiceErrorSeverity;
	public readonly context: ServiceErrorContext;
	public readonly recovery: ServiceErrorRecoveryStrategy;
	public readonly timestamp: string;
	public readonly errorId: string;

	constructor(
		message: string,
		type: ServiceErrorType,
		severity: ServiceErrorSeverity,
		context: Partial<ServiceErrorContext>,
		recovery?: Partial<ServiceErrorRecoveryStrategy>
	) {
		super(message);
		this.name = 'ServiceError';
		this.type = type;
		this.severity = severity;
		this.timestamp = new Date().toISOString();
		this.errorId = this.generateErrorId();

		// Build complete context
		this.context = {
			timestamp: this.timestamp,
			...context,
		} as ServiceErrorContext;

		// Build recovery strategy
		this.recovery = {
			canRetry: false,
			userMessage: this.getDefaultUserMessage(),
			shouldLogout: this.shouldRequireLogout(),
			...recovery,
		};

		// Capture stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ServiceError);
		}
	}

	private generateErrorId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substr(2, 9);
		return `ERR_${timestamp}_${random}`.toUpperCase();
	}

	private getDefaultUserMessage(): string {
		switch (this.type) {
			case ServiceErrorType.NETWORK_ERROR:
				return 'Проблема с подключением к сети. Проверьте интернет соединение.';

			case ServiceErrorType.TIMEOUT:
				return 'Запрос занял слишком много времени. Попробуйте еще раз.';

			case ServiceErrorType.UNAUTHORIZED:
				return 'Необходимо войти в систему для выполнения этого действия.';

			case ServiceErrorType.FORBIDDEN:
				return 'У вас нет прав для выполнения этого действия.';

			case ServiceErrorType.NOT_FOUND:
				return 'Запрашиваемый ресурс не найден.';

			case ServiceErrorType.SERVICE_UNAVAILABLE:
				return 'Сервис временно недоступен. Попробуйте позже.';

			case ServiceErrorType.TOKEN_EXPIRED:
				return 'Сессия истекла. Необходимо войти заново.';

			case ServiceErrorType.AI_MODEL_UNAVAILABLE:
				return 'AI модель временно недоступна. Попробуйте другую модель.';

			case ServiceErrorType.GENERATION_FAILED:
				return 'Не удалось сгенерировать контент. Попробуйте изменить запрос.';

			case ServiceErrorType.WEBSOCKET_ERROR:
				return 'Проблема с real-time соединением. Перезагрузите страницу.';

			default:
				return 'Произошла неожиданная ошибка. Попробуйте еще раз.';
		}
	}

	private shouldRequireLogout(): boolean {
		const logoutTypes: ServiceErrorType[] = [
			ServiceErrorType.TOKEN_EXPIRED,
			ServiceErrorType.TOKEN_INVALID,
			ServiceErrorType.UNAUTHORIZED,
		];
		return logoutTypes.includes(this.type);
	}

	// Get user-friendly error message
	public getUserMessage(): string {
		return this.recovery.userMessage || this.getDefaultUserMessage();
	}

	// Check if error is retryable
	public isRetryable(): boolean {
		return (
			this.recovery.canRetry &&
			(this.context.retryAttempt || 0) < (this.recovery.maxRetries || 3)
		);
	}

	// Get detailed error info for logging
	public getDetailedInfo(): Record<string, unknown> {
		return {
			errorId: this.errorId,
			message: this.message,
			type: this.type,
			severity: this.severity,
			timestamp: this.timestamp,
			context: this.context,
			recovery: this.recovery,
			stack: this.stack,
		};
	}

	// Serialize error for API reporting
	public toJSON(): Record<string, unknown> {
		return {
			errorId: this.errorId,
			message: this.message,
			type: String(this.type),
			severity: String(this.severity),
			timestamp: this.timestamp,
			context: {
				...this.context,
				requestData: undefined, // Don't serialize request data for security
				responseData: undefined, // Don't serialize response data for security
			},
		};
	}
}

// Factory functions for common error types
// biome-ignore lint/complexity/noStaticOnlyClass: grouped static factories used across services layer
export class ServiceErrorFactory {
	static networkError(
		serviceName: string,
		operation: string,
		originalError?: Error
	): ServiceError {
		return new ServiceError(
			`Network error in ${serviceName}.${operation}: ${originalError?.message || 'Connection failed'}`,
			ServiceErrorType.NETWORK_ERROR,
			ServiceErrorSeverity.HIGH,
			{
				serviceName,
				operation,
				stackTrace: originalError?.stack as string | undefined,
			},
			{
				canRetry: true,
				retryDelay: 2000,
				maxRetries: 3,
			}
		);
	}

	static httpError(
		serviceName: string,
		operation: string,
		status: number,
		endpoint: string,
		responseData?: unknown
	): ServiceError {
		let type: ServiceErrorType;
		let severity: ServiceErrorSeverity;

		switch (status) {
			case 400:
				type = ServiceErrorType.BAD_REQUEST;
				severity = ServiceErrorSeverity.MEDIUM;
				break;
			case 401:
				type = ServiceErrorType.UNAUTHORIZED;
				severity = ServiceErrorSeverity.HIGH;
				break;
			case 403:
				type = ServiceErrorType.FORBIDDEN;
				severity = ServiceErrorSeverity.HIGH;
				break;
			case 404:
				type = ServiceErrorType.NOT_FOUND;
				severity = ServiceErrorSeverity.MEDIUM;
				break;
			case 408:
				type = ServiceErrorType.TIMEOUT;
				severity = ServiceErrorSeverity.MEDIUM;
				break;
			case 503:
				type = ServiceErrorType.SERVICE_UNAVAILABLE;
				severity = ServiceErrorSeverity.HIGH;
				break;
			default:
				type = ServiceErrorType.INTERNAL_SERVER_ERROR;
				severity = ServiceErrorSeverity.CRITICAL;
		}

		return new ServiceError(
			`HTTP ${status} error in ${serviceName}.${operation}`,
			type,
			severity,
			{
				serviceName,
				operation,
				endpoint,
				responseStatus: status,
				responseData,
			},
			{
				canRetry: [408, 503, 500].includes(status),
				retryDelay: status === 503 ? 5000 : 1000,
				maxRetries: status === 503 ? 5 : 2,
				shouldLogout: [401, 403].includes(status),
			}
		);
	}

	static authError(
		serviceName: string,
		operation: string,
		type: 'expired' | 'invalid' | 'required'
	): ServiceError {
		const errorType =
			type === 'expired'
				? ServiceErrorType.TOKEN_EXPIRED
				: type === 'invalid'
					? ServiceErrorType.TOKEN_INVALID
					: ServiceErrorType.AUTH_REQUIRED;

		return new ServiceError(
			`Authentication error in ${serviceName}.${operation}: token ${type}`,
			errorType,
			ServiceErrorSeverity.HIGH,
			{ serviceName, operation },
			{
				canRetry: false,
				shouldLogout: true,
			}
		);
	}

	static configError(
		serviceName: string,
		operation: string,
		details: string
	): ServiceError {
		return new ServiceError(
			`Configuration error in ${serviceName}.${operation}: ${details}`,
			ServiceErrorType.CONFIG_ERROR,
			ServiceErrorSeverity.CRITICAL,
			{ serviceName, operation },
			{ canRetry: false }
		);
	}

	static aiError(
		serviceName: string,
		operation: string,
		details: string
	): ServiceError {
		return new ServiceError(
			`AI generation error in ${serviceName}.${operation}: ${details}`,
			ServiceErrorType.GENERATION_FAILED,
			ServiceErrorSeverity.MEDIUM,
			{ serviceName, operation },
			{
				canRetry: true,
				retryDelay: 3000,
				maxRetries: 2,
			}
		);
	}

	static websocketError(
		serviceName: string,
		operation: string,
		details: string
	): ServiceError {
		return new ServiceError(
			`WebSocket error in ${serviceName}.${operation}: ${details}`,
			ServiceErrorType.WEBSOCKET_ERROR,
			ServiceErrorSeverity.MEDIUM,
			{ serviceName, operation },
			{
				canRetry: true,
				retryDelay: 5000,
				maxRetries: 10,
			}
		);
	}
}

// Error recovery helpers
// biome-ignore lint/complexity/noStaticOnlyClass: static retry helper used by BaseService
export class ServiceErrorRecovery {
	static async withRetry<T>(
		operation: () => Promise<T>,
		errorContext: Partial<ServiceErrorContext>,
		maxRetries = 3,
		retryDelay = 1000
	): Promise<T> {
		let lastError: ServiceError | undefined;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, retryDelay * attempt)
					);
				}

				return await operation();
			} catch (error) {
				if (error instanceof ServiceError) {
					lastError = error;
					if (!error.isRetryable() || attempt === maxRetries) {
						throw error;
					}
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					lastError = new ServiceError(
						errorMessage || 'Unknown error',
						ServiceErrorType.UNKNOWN_ERROR,
						ServiceErrorSeverity.MEDIUM,
						{
							...errorContext,
							retryAttempt: attempt,
							totalRetryAttempts: maxRetries,
						}
					);

					if (attempt === maxRetries) {
						throw lastError;
					}
				}
			}
		}

		if (!lastError) {
			throw new ServiceError(
				'Operation failed after retries',
				ServiceErrorType.INTERNAL_SERVER_ERROR,
				ServiceErrorSeverity.CRITICAL,
				errorContext
			);
		}
		throw lastError;
	}
}

export default ServiceError;
