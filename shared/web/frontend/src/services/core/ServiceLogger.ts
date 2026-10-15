import {
	ServiceError,
	ServiceErrorSeverity,
	ServiceErrorType,
} from './ServiceError';
import { log } from '../../utils/logger';
import { apiClient } from '../api/client';
import { getOidcRuntimeProfile } from '../keycloakProfile';

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	CRITICAL = 4,
}

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	serviceName: string;
	operation?: string;
	message: string;
	metadata?: Record<string, unknown>;
	error?: ServiceError;
	requestId?: string;
	userId?: string;
	sessionId?: string;
}

export interface LogTransport {
	name: string;
	enabled: boolean;
	minLevel: LogLevel;
	transport: (entry: LogEntry) => void | Promise<void>;
}

// Professional logging class - НЕ console!
export class ServiceLogger {
	private serviceName: string;
	private transports: LogTransport[] = [];
	private requestId?: string;
	private userId?: string;
	private sessionId?: string;

	constructor(
		serviceName: string,
		options: {
			requestId?: string;
			userId?: string;
			sessionId?: string;
		} = {}
	) {
		this.serviceName = serviceName;
		this.requestId = options.requestId;
		this.userId = options.userId;
		this.sessionId = options.sessionId;

		// Initialize default transports
		this.initializeDefaultTransports();
	}

	private initializeDefaultTransports(): void {
		// Development console transport (only in development)
		if (process.env.NODE_ENV === 'development') {
			this.addTransport({
				name: 'console',
				enabled: true,
				minLevel: LogLevel.DEBUG,
				transport: this.consoleTransport,
			});
		}

		// Browser storage transport for error tracking
		this.addTransport({
			name: 'storage',
			enabled: true,
			minLevel: LogLevel.WARN,
			transport: this.storageTransport,
		});

		// Remote logging transport for production (POST /api/v1/monitoring/logs; legacy /api/monitoring/logs also exists)
		if (import.meta.env.PROD) {
			this.addTransport({
				name: 'remote',
				enabled: true,
				minLevel: LogLevel.ERROR,
				transport: this.remoteTransport,
			});
		}
	}

	// Console transport (только для development!)
	private consoleTransport = (entry: LogEntry): void => {
		if (process.env.NODE_ENV !== 'development') {
			return;
		}

		const timestamp = new Date(entry.timestamp).toLocaleTimeString();
		const prefix = `🔥 [${timestamp}] ${entry.serviceName}${entry.operation ? `::${entry.operation}` : ''}`;

		switch (entry.level) {
			case LogLevel.DEBUG:
				log.debug(`${prefix} 🐛`, entry.message, entry.metadata);
				break;
			case LogLevel.INFO:
				log.info(`${prefix} ℹ️`, entry.message, entry.metadata);
				break;
			case LogLevel.WARN:
				log.warn(`${prefix} ⚠️`, entry.message, entry.metadata);
				break;
			case LogLevel.ERROR:
				log.error(
					`${prefix} ❌`,
					entry.message,
					entry.error,
					entry.error?.getDetailedInfo() ?? entry.metadata
				);
				break;
			case LogLevel.CRITICAL:
				log.error(
					`${prefix} 🚨`,
					entry.message,
					entry.error,
					entry.error?.getDetailedInfo() ?? entry.metadata
				);
				break;
		}
	};

	// Local storage transport for error persistence
	private storageTransport = (entry: LogEntry): void => {
		try {
			const storageKey = `eliteew_logs_${entry.serviceName}`;
			const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');

			// Keep only last 100 entries per service
			const logs = [...existingLogs, entry].slice(-100);

			localStorage.setItem(storageKey, JSON.stringify(logs));
		} catch (_error) {
			// Fallback - storage might be full
		}
	};

	// Remote transport for production error tracking
	private remoteTransport = async (entry: LogEntry): Promise<void> => {
		// FoFline W5 denies /monitoring/logs — never boot-spam deny (A3).
		try {
			if (getOidcRuntimeProfile() === 'foflineNative') {
				return;
			}
		} catch {
			// profile helpers must not break logging
		}
		try {
			await apiClient.post('/api/v1/monitoring/logs', {
				...entry,
				error: entry.error?.toJSON(),
			});
		} catch {
			// Silent fail for logging - don't break the app
		}
	};

	// Add transport
	public addTransport(transport: LogTransport): void {
		this.transports.push(transport);
	}

	// Remove transport
	public removeTransport(name: string): void {
		this.transports = this.transports.filter((t) => t.name !== name);
	}

	// Core logging method
	private log(
		level: LogLevel,
		message: string,
		metadata?: Record<string, unknown>,
		error?: ServiceError
	): void {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			serviceName: this.serviceName,
			message,
			metadata,
			error,
			requestId: this.requestId,
			userId: this.userId,
			sessionId: this.sessionId,
		};

		// Send to all enabled transports that accept this log level
		this.transports
			.filter((transport) => transport.enabled && level >= transport.minLevel)
			.forEach((transport) => {
				try {
					transport.transport(entry);
				} catch (_transportError) {
					// Don't let transport errors break logging
				}
			});
	}

	// Public logging methods
	public debug(message: string, metadata?: Record<string, unknown>): void {
		this.log(LogLevel.DEBUG, message, metadata);
	}

	public info(message: string, metadata?: Record<string, unknown>): void {
		this.log(LogLevel.INFO, message, metadata);
	}

	public warn(message: string, metadata?: Record<string, unknown>): void {
		this.log(LogLevel.WARN, message, metadata);
	}

	public error(
		message: string,
		error?: ServiceError | Error,
		metadata?: Record<string, unknown>
	): void {
		const serviceError =
			error instanceof ServiceError
				? error
				: error instanceof Error
					? new ServiceError(
							error.message,
							ServiceErrorType.UNKNOWN_ERROR,
							ServiceErrorSeverity.MEDIUM,
							{ serviceName: this.serviceName, stackTrace: error.stack }
						)
					: undefined;

		this.log(LogLevel.ERROR, message, metadata, serviceError);
	}

	public critical(
		message: string,
		error?: ServiceError | Error,
		metadata?: Record<string, unknown>
	): void {
		const serviceError =
			error instanceof ServiceError
				? error
				: error instanceof Error
					? new ServiceError(
							error.message,
							ServiceErrorType.UNKNOWN_ERROR,
							ServiceErrorSeverity.CRITICAL,
							{ serviceName: this.serviceName, stackTrace: error.stack }
						)
					: undefined;

		this.log(LogLevel.CRITICAL, message, metadata, serviceError);
	}

	// Operation-specific logging
	public operation(operationName: string): OperationLogger {
		return new OperationLogger(this, operationName);
	}

	// Request-specific logging
	public request(requestId: string, operation: string): RequestLogger {
		return new RequestLogger(this, requestId, operation);
	}

	// Get stored logs for debugging
	public getStoredLogs(): LogEntry[] {
		try {
			const storageKey = `eliteew_logs_${this.serviceName}`;
			return JSON.parse(localStorage.getItem(storageKey) || '[]');
		} catch {
			return [];
		}
	}

	// Clear stored logs
	public clearStoredLogs(): void {
		try {
			const storageKey = `eliteew_logs_${this.serviceName}`;
			localStorage.removeItem(storageKey);
		} catch {
			// Silent fail
		}
	}
}

// Operation-specific logger
export class OperationLogger {
	private parentLogger: ServiceLogger;
	private operationName: string;
	private startTime: number;

	constructor(parentLogger: ServiceLogger, operationName: string) {
		this.parentLogger = parentLogger;
		this.operationName = operationName;
		this.startTime = Date.now();
	}

	public debug(message: string, metadata?: Record<string, unknown>): void {
		this.parentLogger.debug(`[${this.operationName}] ${message}`, metadata);
	}

	public info(message: string, metadata?: Record<string, unknown>): void {
		this.parentLogger.info(`[${this.operationName}] ${message}`, metadata);
	}

	public warn(message: string, metadata?: Record<string, unknown>): void {
		this.parentLogger.warn(`[${this.operationName}] ${message}`, metadata);
	}

	public error(
		message: string,
		error?: ServiceError | Error,
		metadata?: Record<string, unknown>
	): void {
		this.parentLogger.error(
			`[${this.operationName}] ${message}`,
			error,
			metadata
		);
	}

	public success(message: string, metadata?: Record<string, unknown>): void {
		const duration = Date.now() - this.startTime;
		this.parentLogger.info(`[${this.operationName}] SUCCESS: ${message}`, {
			...metadata,
			duration_ms: duration,
		});
	}

	public failure(
		message: string,
		error?: ServiceError | Error,
		metadata?: Record<string, unknown>
	): void {
		const duration = Date.now() - this.startTime;
		this.parentLogger.error(
			`[${this.operationName}] FAILURE: ${message}`,
			error,
			{
				...metadata,
				duration_ms: duration,
			}
		);
	}
}

// Request-specific logger with tracking
export class RequestLogger extends OperationLogger {
	private requestId: string;

	constructor(
		parentLogger: ServiceLogger,
		requestId: string,
		operation: string
	) {
		super(parentLogger, operation);
		this.requestId = requestId;
	}

	public debug(message: string, metadata?: Record<string, unknown>): void {
		super.debug(message, { ...metadata, requestId: this.requestId });
	}

	public info(message: string, metadata?: Record<string, unknown>): void {
		super.info(message, { ...metadata, requestId: this.requestId });
	}

	public warn(message: string, metadata?: Record<string, unknown>): void {
		super.warn(message, { ...metadata, requestId: this.requestId });
	}

	public error(
		message: string,
		error?: ServiceError | Error,
		metadata?: Record<string, unknown>
	): void {
		super.error(message, error, { ...metadata, requestId: this.requestId });
	}
}

// Factory function to create service loggers
export function createServiceLogger(
	serviceName: string,
	options: {
		requestId?: string;
		userId?: string;
		sessionId?: string;
	} = {}
): ServiceLogger {
	return new ServiceLogger(serviceName, options);
}

// Global logger registry
const loggerRegistry = new Map<string, ServiceLogger>();

export function getServiceLogger(serviceName: string): ServiceLogger {
	let logger = loggerRegistry.get(serviceName);
	if (!logger) {
		logger = createServiceLogger(serviceName);
		loggerRegistry.set(serviceName, logger);
	}
	return logger;
}

// Utility to get all logs from all services
export function getAllServiceLogs(): Record<string, LogEntry[]> {
	const allLogs: Record<string, LogEntry[]> = {};

	loggerRegistry.forEach((logger, serviceName) => {
		allLogs[serviceName] = logger.getStoredLogs();
	});

	return allLogs;
}

export default ServiceLogger;
