/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 26 thin facade: default Axios instances, `api` helpers, and re-exports for the
 * EliteEW backend HTTP client (`/api/*`).
 *
 * Invariants:
 * - `/api/*` requests go through `apiClient` / `createAPIClient`, not raw axios.
 * - Public import path remains `services/api/client` (and barrel `services/api`).
 *
 * Related:
 * - apiClientCore.ts, createAPIClient.ts, apiFetchWithAuth.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §5 / L3
 */
import type { AxiosRequestConfig } from 'axios';
import { unwrapApiData } from './apiClientCore';
import { createAPIClient } from './createAPIClient';

export {
	APIError,
	isRequestAborted,
	unwrapApiData,
	type APIResponse,
	type PaginatedResponse,
	type AuthErrorBody,
	resetSessionReplaceConfirmationStateForTests,
	resetSessionReplacedHandlingStateForTests,
} from './apiClientCore';
export { createAPIClient } from './createAPIClient';
export { apiFetchWithAuth } from './apiFetchWithAuth';

/**
 * Default API Client Instance (main API, baseURL = '' in browser → full paths /api/v1/...)
 */
export const apiClient = createAPIClient();
export const adminApiClient = createAPIClient();
export const publicApiClient = createAPIClient();

/**
 * Helper functions for common operations (uses default apiClient)
 */
export const api = {
	/**
	 * GET request. Use `config.signal` (AbortSignal) to cancel.
	 */
	get: async <T = unknown>(
		url: string,
		config?: AxiosRequestConfig
	): Promise<T> => {
		const response = await apiClient.get<T>(url, config);
		// Backend возвращает данные напрямую (НЕ обёрнутые в { data: ... })
		return response.data;
	},

	/**
	 * POST request. Use `config.signal` to cancel.
	 */
	post: async <T = unknown>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> => {
		const response = await apiClient.post<T>(url, data, config);
		// Backend возвращает данные напрямую
		return response.data;
	},

	/**
	 * PUT request
	 */
	put: async <T = unknown>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> => {
		const response = await apiClient.put<T>(url, data, config);
		// Backend возвращает данные напрямую
		return response.data;
	},

	/**
	 * PATCH request
	 */
	patch: async <T = unknown>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> => {
		const response = await apiClient.patch<unknown>(url, data, config);
		return unwrapApiData<T>(response.data);
	},

	/**
	 * DELETE request
	 */
	delete: async <T = unknown>(
		url: string,
		config?: AxiosRequestConfig
	): Promise<T> => {
		const response = await apiClient.delete<unknown>(url, config);
		if (response.status === 204 || response.data == null) {
			return undefined as T;
		}
		return unwrapApiData<T>(response.data);
	},

	/**
	 * Upload file with progress tracking
	 */
	upload: async <T = unknown>(
		url: string,
		file: File,
		onProgress?: (progress: number) => void,
		additionalData?: Record<string, unknown>
	): Promise<T> => {
		const formData = new FormData();
		formData.append('file', file);

		if (additionalData) {
			Object.entries(additionalData).forEach(([key, value]) => {
				formData.append(key, String(value));
			});
		}

		const response = await apiClient.post<unknown>(url, formData, {
			headers: {
				'Content-Type': 'multipart/form-data',
			},
			onUploadProgress: (progressEvent) => {
				if (onProgress && progressEvent.total) {
					const progress = Math.round(
						(progressEvent.loaded * 100) / progressEvent.total
					);
					onProgress(progress);
				}
			},
		});

		return unwrapApiData<T>(response.data);
	},
};

/**
 * Build query string from object
 */
export const buildQueryString = (params: Record<string, unknown>): string => {
	const searchParams = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			if (Array.isArray(value)) {
				value.forEach((v) => {
					searchParams.append(key, String(v));
				});
			} else {
				searchParams.append(key, String(value));
			}
		}
	});

	const queryString = searchParams.toString();
	return queryString ? `?${queryString}` : '';
};
