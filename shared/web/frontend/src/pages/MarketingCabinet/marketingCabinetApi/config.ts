import { API_CONFIG } from '../../../services/api/config';

export const MARKETING_TIMEOUT_MULTIPLIER = 3;
export const MARKETING_API_TIMEOUT_MS =
	API_CONFIG.timeout * MARKETING_TIMEOUT_MULTIPLIER;
export const MARKETING_LONG_TIMEOUT_MS =
	API_CONFIG.longTimeout * MARKETING_TIMEOUT_MULTIPLIER;

/** Shared low-level options for `/api/v1` marketing cabinet HTTP calls. */
export const API_OPTIONS = {
	baseURL: '/api/v1',
	timeout: MARKETING_API_TIMEOUT_MS,
} as const;

export const LONG_API_OPTIONS = {
	...API_OPTIONS,
	timeout: MARKETING_LONG_TIMEOUT_MS,
} as const;
