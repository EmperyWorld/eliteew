/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central frontend logger with development console output, bounded in-memory
 * buffer, API tracing helpers, and production-safe secret redaction.
 *
 * Invariants:
 * - Tokens, authorization headers, cookies, passwords, and client secrets are redacted before console/buffer/export sinks.
 * - Production log level defaults to warnings and errors only.
 *
 * Related:
 * - src/services/api/client.ts
 * - documentation/platform/FRONTEND-SPA-BEARER-THREAT-MODEL.md
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export interface ComponentLogEntry {
	timestamp: string;
	level: LogLevel;
	component: string;
	message: string;
	data?: unknown;
	stack?: string;
}

const SECRET_KEY_PATTERN =
	/(authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|secret|client[_-]?secret|api[_-]?key)/i;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i;
const REDACTED = '[redacted]';

export function redactSecrets(
	value: unknown,
	seen: WeakSet<object> = new WeakSet(),
	depth = 0
): unknown {
	if (value == null) return value;
	if (typeof value === 'string') {
		return BEARER_VALUE_PATTERN.test(value) ? REDACTED : value;
	}
	if (typeof value !== 'object') return value;
	if (depth > 8) return '[truncated]';

	if (value instanceof Error) {
		return {
			name: value.name,
			message: redactSecrets(value.message, seen, depth + 1),
			stack: value.stack,
		};
	}
	if (seen.has(value)) return '[circular]';
	seen.add(value);

	if (Array.isArray(value)) {
		return value.map((item) => redactSecrets(item, seen, depth + 1));
	}

	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		out[key] = SECRET_KEY_PATTERN.test(key)
			? REDACTED
			: redactSecrets(entry, seen, depth + 1);
	}
	return out;
}

class EmperyworldLogger {
	private static instance: EmperyworldLogger;
	private logLevel: LogLevel;
	private isDevelopment: boolean;
	private logs: ComponentLogEntry[] = [];
	private maxLogs = 1000;

	private constructor() {
		this.isDevelopment =
			import.meta.env.DEV || import.meta.env.MODE === 'development';
		this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
	}

	public static getInstance(): EmperyworldLogger {
		if (!EmperyworldLogger.instance) {
			EmperyworldLogger.instance = new EmperyworldLogger();
		}
		return EmperyworldLogger.instance;
	}

	private formatMessage(
		level: LogLevel,
		component: string,
		message: string
	): string {
		const levelStr = LogLevel[level];
		const timestamp = new Date().toISOString();
		return `[${timestamp}] [${levelStr}] [${component}] ${message}`;
	}

	private getLevelIcon(level: LogLevel): string {
		switch (level) {
			case LogLevel.DEBUG:
				return '🧪';
			case LogLevel.INFO:
				return '💎';
			case LogLevel.WARN:
				return '⚠️';
			case LogLevel.ERROR:
				return '🔥';
			default:
				return '📝';
		}
	}

	private getLevelStyle(level: LogLevel): string {
		const base = 'font-weight: bold;';
		switch (level) {
			case LogLevel.DEBUG:
				return `${base} color: #22d3ee;`;
			case LogLevel.INFO:
				return `${base} color: #3b82f6;`;
			case LogLevel.WARN:
				return `${base} color: #f59e0b;`;
			case LogLevel.ERROR:
				return `${base} color: #ef4444;`;
			default:
				return `${base} color: #6b7280;`;
		}
	}

	private shouldLog(level: LogLevel): boolean {
		return level >= this.logLevel;
	}

	private addToBuffer(entry: ComponentLogEntry): void {
		this.logs.push(entry);

		// Ограничиваем размер буфера
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}
	}

	// 🔥 DEBUG - только для development
	debug(component: string, message: string, data?: unknown): void {
		if (!this.shouldLog(LogLevel.DEBUG)) {
			return;
		}
		const safeData = redactSecrets(data);

		const entry: ComponentLogEntry = {
			timestamp: new Date().toISOString(),
			level: LogLevel.DEBUG,
			component,
			message,
			data: safeData,
		};

		if (this.isDevelopment) {
			const icon = this.getLevelIcon(LogLevel.DEBUG);
			const style = this.getLevelStyle(LogLevel.DEBUG);
			const formatted = this.formatMessage(LogLevel.DEBUG, component, message);

			if (safeData && typeof safeData === 'object') {
				// eslint-disable-next-line no-console
				console.groupCollapsed(`%c${icon} ${formatted}`, style);
				// eslint-disable-next-line no-console
				console.log('Data:', safeData);
				// eslint-disable-next-line no-console
				console.groupEnd();
			} else {
				// eslint-disable-next-line no-console
				console.log(`%c${icon} ${formatted}`, style, safeData || '');
			}
		}

		this.addToBuffer(entry);
	}

	// 💎 INFO - важная информация для development
	info(component: string, message: string, data?: unknown): void {
		if (!this.shouldLog(LogLevel.INFO)) {
			return;
		}
		const safeData = redactSecrets(data);

		const entry: ComponentLogEntry = {
			timestamp: new Date().toISOString(),
			level: LogLevel.INFO,
			component,
			message,
			data: safeData,
		};

		if (this.isDevelopment) {
			// eslint-disable-next-line no-console
			console.info(
				`%c💎 ${this.formatMessage(LogLevel.INFO, component, message)}`,
				'color: #3b82f6; font-weight: bold;',
				safeData || ''
			);
		}

		this.addToBuffer(entry);
	}

	// ⚠️ WARN - всегда логируем warnings
	warn(component: string, message: string, data?: unknown): void {
		if (!this.shouldLog(LogLevel.WARN)) {
			return;
		}
		const safeData = redactSecrets(data);

		const entry: ComponentLogEntry = {
			timestamp: new Date().toISOString(),
			level: LogLevel.WARN,
			component,
			message,
			data: safeData,
		};

		// eslint-disable-next-line no-console
		console.warn(
			`%c⚠️ ${this.formatMessage(LogLevel.WARN, component, message)}`,
			'color: #f59e0b; font-weight: bold;',
			safeData || ''
		);

		this.addToBuffer(entry);

		// В production можно отправлять в external service
		if (!this.isDevelopment) {
			this.sendToExternalService(entry);
		}
	}

	// 🔥 ERROR - всегда логируем ошибки
	error(
		component: string,
		message: string,
		error?: Error,
		data?: unknown
	): void {
		const safeData = redactSecrets(data);
		const safeError = redactSecrets(error);
		const entry: ComponentLogEntry = {
			timestamp: new Date().toISOString(),
			level: LogLevel.ERROR,
			component,
			message,
			data: safeData,
			stack: error?.stack,
		};

		const icon = this.getLevelIcon(LogLevel.ERROR);
		const style = this.getLevelStyle(LogLevel.ERROR);
		const formatted = this.formatMessage(LogLevel.ERROR, component, message);

		// eslint-disable-next-line no-console
		console.group(`%c${icon} ${formatted}`, style);

		if (error) {
			// eslint-disable-next-line no-console
			console.error('Error:', safeError);
			if (error.stack) {
				// eslint-disable-next-line no-console
				console.error('Stack trace:');
				// eslint-disable-next-line no-console
				console.error(error.stack);
			}
		}

		if (data) {
			// eslint-disable-next-line no-console
			console.error('Additional data:', safeData);
		}

		// eslint-disable-next-line no-console
		console.groupEnd();

		this.addToBuffer(entry);

		// В production отправляем критические ошибки
		if (!this.isDevelopment) {
			this.sendToExternalService(entry);
		}
	}

	// 🎯 PERFORMANCE - для замера времени выполнения
	time(component: string, label: string): void {
		if (this.isDevelopment) {
			// eslint-disable-next-line no-console
			console.time(`⚡ [${component}] ${label}`);
		}
	}

	timeEnd(component: string, label: string): void {
		if (this.isDevelopment) {
			// eslint-disable-next-line no-console
			console.timeEnd(`⚡ [${component}] ${label}`);
		}
	}

	// 📊 API REQUEST - специально для API вызовов
	apiRequest(
		component: string,
		method: string,
		url: string,
		data?: unknown
	): void {
		const safeData = redactSecrets(data);
		if (this.isDevelopment) {
			const methodColors: Record<string, string> = {
				GET: '#3b82f6',
				POST: '#10b981',
				PUT: '#f59e0b',
				PATCH: '#8b5cf6',
				DELETE: '#ef4444',
			};
			const color = methodColors[method.toUpperCase()] || '#6b7280';

			// eslint-disable-next-line no-console
			console.group(
				`%c🌐 ${method.toUpperCase()} ${url}`,
				`color: ${color}; font-weight: bold; font-size: 13px;`
			);
			if (safeData) {
				// eslint-disable-next-line no-console
				console.log('Request payload:', safeData);
			}
			// eslint-disable-next-line no-console
			console.log('Timestamp:', new Date().toLocaleTimeString());
			// eslint-disable-next-line no-console
			console.groupEnd();
		}

		this.addToBuffer({
			timestamp: new Date().toISOString(),
			level: LogLevel.INFO,
			component: `${component}:API`,
			message: `${method.toUpperCase()} ${url}`,
			data: safeData,
		});
	}

	// 📊 API RESPONSE - для ответов API
	apiResponse(
		component: string,
		method: string,
		url: string,
		status: number,
		data?: unknown
	): void {
		const safeData = redactSecrets(data);
		const isError = status >= 400;
		const color = isError ? '#ef4444' : '#10b981';
		const icon = isError ? '🔴' : '🟢';
		const statusText = isError ? 'ERROR' : 'SUCCESS';

		if (this.isDevelopment) {
			// eslint-disable-next-line no-console
			console.group(
				`%c${icon} ${method.toUpperCase()} ${url} → ${status} ${statusText}`,
				`color: ${color}; font-weight: bold; font-size: 13px;`
			);

			if (safeData) {
				if (
					typeof safeData === 'object' &&
					!Array.isArray(safeData) &&
					Object.keys(safeData).length < 10
				) {
					// eslint-disable-next-line no-console
					console.table(safeData);
				} else {
					// eslint-disable-next-line no-console
					console.log('Response:', safeData);
				}
			}

			// eslint-disable-next-line no-console
			console.log('Status:', status);
			// eslint-disable-next-line no-console
			console.log('Timestamp:', new Date().toLocaleTimeString());
			// eslint-disable-next-line no-console
			console.groupEnd();
		}

		this.addToBuffer({
			timestamp: new Date().toISOString(),
			level: isError ? LogLevel.ERROR : LogLevel.INFO,
			component: `${component}:API`,
			message: `${method.toUpperCase()} ${url} → ${status}`,
			data: safeData,
		});
	}

	// 📈 ANALYTICS - для аналитики и метрик
	analytics(component: string, event: string, data?: unknown): void {
		const safeData = redactSecrets(data);
		if (this.isDevelopment) {
			// eslint-disable-next-line no-console
			console.log(
				`%c📈 ANALYTICS: ${event}`,
				'color: #8b5cf6; font-weight: bold;',
				safeData || ''
			);
		}

		this.addToBuffer({
			timestamp: new Date().toISOString(),
			level: LogLevel.INFO,
			component: `${component}:Analytics`,
			message: event,
			data: safeData,
		});

		// В production отправляем аналитику
		if (!this.isDevelopment) {
			this.sendAnalytics(event, safeData);
		}
	}

	/**
	 * UX error: user-facing failure with scenario and operation for observability.
	 * Logs locally via error() with structured context.
	 */
	uxError(
		component: string,
		scenario: string,
		operation: string,
		error?: Error,
		data?: unknown
	): void {
		const message = `[UX] ${scenario}: ${operation} failed`;
		const context = {
			scenario,
			operation,
			...(data && typeof data === 'object' ? (data as object) : { data }),
		};
		this.error(component, message, error, context);
	}

	// 🔒 Получить все логи (для debugging)
	getLogs(): ComponentLogEntry[] {
		return [...this.logs];
	}

	// 🔒 Очистить логи
	clearLogs(): void {
		this.logs = [];
	}

	// 📤 Отправка в внешний сервис (для production)
	private async sendToExternalService(
		_entry: ComponentLogEntry
	): Promise<void> {
		// Здесь можно интегрировать с внешним log/analytics сервисом через backend API.
		// await fetch('/api/logs', {
		//   method: 'POST',
		//   headers: { 'Content-Type': 'application/json' },
		//   body: JSON.stringify(_entry)
		// });
	}

	// 📊 Отправка аналитики
	private async sendAnalytics(_event: string, _data?: unknown): Promise<void> {
		// Интеграция с Google Analytics, Mixpanel и т.д.
		// gtag('event', _event, _data);
	}
}

// 🔥 SINGLETON INSTANCE
const logger = EmperyworldLogger.getInstance();

// 💎 ЭКСПОРТ CONVENIENCE ФУНКЦИЙ
// Backward compatible: log(anything) - accepts any arguments
/** Log a UX-facing failure with scenario and operation. */
export function logUxError(
	component: string,
	scenario: string,
	operation: string,
	error?: Error,
	data?: unknown
): void {
	logger.uxError(component, scenario, operation, error, data);
}

type LogFunction = {
	(...args: unknown[]): void;
	debug: (component: string, message: string, data?: unknown) => void;
	info: (component: string, message: string, data?: unknown) => void;
	warn: (component: string, message: string, data?: unknown) => void;
	error: (
		component: string,
		message: string,
		error?: Error,
		data?: unknown
	) => void;
	uxError: (
		component: string,
		scenario: string,
		operation: string,
		error?: Error,
		data?: unknown
	) => void;
	time: (component: string, label: string) => void;
	timeEnd: (component: string, label: string) => void;
	api: {
		request: (
			component: string,
			method: string,
			url: string,
			data?: unknown
		) => void;
		response: (
			component: string,
			method: string,
			url: string,
			status: number,
			data?: unknown
		) => void;
	};
	analytics: (component: string, event: string, data?: unknown) => void;
	getLogs: () => ComponentLogEntry[];
	clearLogs: () => void;
};

// Main log function with backward compatibility - accepts anything
const logFn = (...args: unknown[]): void => {
	if (args.length === 0) return;

	if (
		args.length >= 2 &&
		typeof args[0] === 'string' &&
		typeof args[1] === 'string'
	) {
		// New API: log(component, message, data?)
		logger.info(args[0], args[1], args[2]);
	} else {
		// Old API: log(anything) - stringify and log
		const message = args
			.map((arg) =>
				typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
			)
			.join(' ');
		logger.info('App', message);
	}
};

export const log: LogFunction = Object.assign(logFn, {
	debug: (component: string, message: string, data?: unknown) =>
		logger.debug(component, message, data),
	info: (component: string, message: string, data?: unknown) =>
		logger.info(component, message, data),
	warn: (component: string, message: string, data?: unknown) =>
		logger.warn(component, message, data),
	error: (component: string, message: string, error?: Error, data?: unknown) =>
		logger.error(component, message, error, data),
	uxError: (
		component: string,
		scenario: string,
		operation: string,
		error?: Error,
		data?: unknown
	) => logger.uxError(component, scenario, operation, error, data),

	// Специальные методы
	time: (component: string, label: string) => logger.time(component, label),
	timeEnd: (component: string, label: string) =>
		logger.timeEnd(component, label),

	api: {
		request: (component: string, method: string, url: string, data?: unknown) =>
			logger.apiRequest(component, method, url, data),
		response: (
			component: string,
			method: string,
			url: string,
			status: number,
			data?: unknown
		) => logger.apiResponse(component, method, url, status, data),
	},

	analytics: (component: string, event: string, data?: unknown) =>
		logger.analytics(component, event, data),

	// Управление логами
	getLogs: () => logger.getLogs(),
	clearLogs: () => logger.clearLogs(),
});

// 🔥 DEFAULT EXPORT
export default logger;

// 💎 TYPE EXPORTS - ComponentLogEntry уже экспортирован как interface выше
