/**
 * @fileoverview Global Error Handler with Toast Notifications
 *
 * @role Error Handling Layer
 *   - Primary responsibility: Centralized error handling, user-facing toast notifications
 *   - Used by: All API hooks and components for error display
 *   - Integration: React Hot Toast, APIError class from client
 *
 * @architecture
 *   - Layer: Service / Error Handling
 *   - Pattern: Global error handler with toast notifications
 *   - Integration: React Hot Toast for UI notifications, network monitoring
 *
 * @status
 *   - TypeScript errors fixed: 2 (endpoint property added to APIError in client.ts)
 *   - Last audit: 2025-10-23 - Agent 1 (API Hooks & Services)
 *
 * @version 2.0.0
 * @date 2025-10-13
 */

import axios from 'axios';
import { notify } from '@/notifications';
import { APIError } from './client';
import { ErrorMessages, OperationMessages } from './config';
import {
	shouldDedupeErrorToast,
	shouldSuppressApiErrorToast,
} from '../maintenance/recoveryNotificationGuard';
import { logUxError } from '../../utils/uxErrorLog';
import { log } from '../../utils/logger';

const ERROR_TOAST_DURATION = 5000;

/**
 * Normalize any thrown value to a single contract: APIError or string message.
 * Use in hooks/components so UI always gets one format (error.message or string).
 */
function isAbortLike(error: unknown): boolean {
	if (axios.isCancel(error)) {
		return true;
	}
	if (!axios.isAxiosError(error)) {
		return false;
	}
	return (
		error.code === 'ERR_CANCELED' ||
		error.name === 'CanceledError' ||
		error.message === 'canceled'
	);
}

export function normalizeApiError(error: unknown): APIError | string {
	if (error instanceof APIError) {
		return error;
	}
	if (isAbortLike(error)) {
		return ErrorMessages.canceled;
	}
	if (axios.isAxiosError(error) && error.response?.data) {
		const data = error.response.data as {
			detail?: string;
			message?: string;
			error?: string;
		};
		const detail =
			typeof data.detail === 'string'
				? data.detail
				: data.detail != null
					? String(data.detail)
					: undefined;
		return (
			detail ??
			data.message ??
			(typeof data.error === 'string' ? data.error : undefined) ??
			error.message ??
			ErrorMessages.unknown
		);
	}
	if (axios.isAxiosError(error) && !error.response) {
		const msg = error.message || '';
		if (/timeout/i.test(msg) || error.code === 'ECONNABORTED') {
			return ErrorMessages.timeout;
		}
		if (error.request) {
			return ErrorMessages.network;
		}
	}
	if (error instanceof Error) {
		return error.message;
	}
	return ErrorMessages.unknown;
}
const SUCCESS_TOAST_DURATION = 3000;

/**
 * Get user-friendly error message
 */
const getUserFriendlyMessage = (error: APIError): string => {
	if (error.errorCode === 'TIMEOUT' || error.statusCode === 408) {
		return ErrorMessages.timeout;
	}
	if (error.errorCode === 'NETWORK_ERROR' || error.isNetworkError) {
		return ErrorMessages.network;
	}
	if (error.errorCode === 'UNKNOWN_ERROR' && !error.statusCode) {
		return error.message || ErrorMessages.unknown;
	}

	if (error.statusCode === 401) {
		return ErrorMessages.unauthorized;
	}

	if (error.statusCode === 403) {
		return ErrorMessages.forbidden;
	}

	if (error.statusCode === 404) {
		return ErrorMessages.notFound;
	}

	if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
		return error.message || ErrorMessages.validation;
	}

	if (error.isServerError) {
		return ErrorMessages.serverError;
	}

	return error.message || ErrorMessages.unknown;
};

/**
 * Handle API Error with Toast Notification
 */
export const handleAPIError = (
	error: unknown,
	customMessage?: string
): void => {
	if (isAbortLike(error)) {
		return;
	}

	if (shouldSuppressApiErrorToast(error)) {
		return;
	}

	// Log errors appropriately based on severity
	if (error instanceof APIError) {
		// Only log server errors (5xx) and unexpected errors as console.error
		// Client errors (4xx) are expected and should be console.warn or silent
		if (error.isServerError || (error.statusCode && error.statusCode >= 500)) {
			log.error(
				'[API Error]',
				`Server error: ${String(error.statusCode ?? '')} ${error.message}`,
				error instanceof Error ? error : undefined
			);
		} else if (error.statusCode === 401 || error.statusCode === 403) {
			log.warn(
				'[API Error]',
				`Auth error: ${String(error.statusCode)} ${error.endpoint || 'unknown endpoint'}`
			);
			logUxError(
				'auth',
				error.statusCode === 403 ? 'forbidden' : 'unauthorized',
				error,
				{
					api: { statusCode: error.statusCode, endpoint: error.endpoint },
				}
			);
		} else if (error.statusCode === 404) {
			// 404 can be expected, log only in dev mode
			if (import.meta.env.DEV) {
				log.warn(
					'[API Error] Not found:',
					error.endpoint || 'unknown endpoint'
				);
			}
		} else if (error.isNetworkError) {
			log.warn('[API Error] Network error:', error.message);
		} else {
			// Other client errors
			log.warn(
				'[API Error]',
				`Client error: ${String(error.statusCode ?? '')} ${error.message}`
			);
		}

		const message = customMessage || getUserFriendlyMessage(error);

		if (!shouldDedupeErrorToast('Ошибка', message)) {
			notify.error('Ошибка', message, { duration: ERROR_TOAST_DURATION });
		}

		// Handle specific error scenarios
		if (error.statusCode === 401) {
			// Redirect to login (OAuth2 Proxy will handle this)
			// Don't use window.location.href = '/' to avoid infinite loop
			log.warn('[Auth]', 'Unauthorized - OAuth2 Proxy should redirect');
		}

		if (error.statusCode === 403) {
			// Show access denied message
			log.warn('[Auth]', 'Forbidden - insufficient permissions');
		}
	} else if (error instanceof Error) {
		log.error('[API Error] Unexpected error:', error.message);
	} else {
		log.error('[API Error]', 'Unknown error type', undefined, error);
	}
};

/**
 * Show success message
 */
export const showSuccess = (message: string): void => {
	notify.success(message, undefined, { duration: SUCCESS_TOAST_DURATION });
};

/**
 * Show info message
 */
export const showInfo = (message: string): void => {
	notify.info(message, undefined, { duration: 4000 });
};

/**
 * Show warning message
 */
export const showWarning = (message: string): void => {
	notify.warning(message, undefined, { duration: 4000 });
};

/**
 * Show error message
 */
export const showError = (message: string): void => {
	log.error('[Error]', message);
	notify.error(message, undefined, { duration: ERROR_TOAST_DURATION });
};

/**
 * Show loading toast (returns Sonner toast id)
 */
export const showLoading = (message: string): string | number => {
	return notify.loading(message);
};

/**
 * Dismiss toast
 */
export const dismissToast = (toastId: string | number): void => {
	notify.dismiss(toastId);
};

/**
 * Error Boundary Handler
 * For use with React Error Boundary
 */
export const logErrorToService = (
	error: Error,
	errorInfo: React.ErrorInfo
): void => {
	log.error('[Error Boundary]', error.message || 'Critical error', error, {
		componentStack: errorInfo.componentStack,
	});
	notify.error(
		'Критическая ошибка',
		'Произошла критическая ошибка. Страница будет перезагружена.',
		{ duration: 7000 }
	);
};

/**
 * Network Status Monitoring
 */
export const setupNetworkMonitoring = (): void => {
	// Online/Offline events
	window.addEventListener('online', () => {
		showSuccess('Соединение восстановлено');
	});

	window.addEventListener('offline', () => {
		showWarning('Отсутствует подключение к интернету');
	});
};

// Re-export OperationMessages for convenience
export { OperationMessages };
