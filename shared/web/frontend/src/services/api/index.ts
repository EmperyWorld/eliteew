/**
 * API Services Barrel Export
 * Central export point for all API-related services
 *
 * @version 1.0.0
 * @date 2025-10-16
 */

import { api, apiClient, buildQueryString, createAPIClient } from './client';
import {
	API_CONFIG,
	ErrorMessages,
	SITE_STUDIO_PROXY_BASE_PATH,
} from './config';
import { handleAPIError, normalizeApiError } from './error-handler';
import {
	rewriteSiteStudioProxyUrl,
	SITE_STUDIO_PROXY_BASE,
} from './siteStudioProxy';

const _apiBarrelSmoke =
	typeof api.get === 'function' &&
	typeof apiClient.request === 'function' &&
	typeof createAPIClient === 'function' &&
	typeof buildQueryString === 'function' &&
	typeof API_CONFIG.timeout === 'number' &&
	typeof ErrorMessages.network === 'string' &&
	SITE_STUDIO_PROXY_BASE_PATH.length > 0 &&
	SITE_STUDIO_PROXY_BASE === SITE_STUDIO_PROXY_BASE_PATH &&
	typeof rewriteSiteStudioProxyUrl === 'function' &&
	typeof handleAPIError === 'function' &&
	typeof normalizeApiError === 'function';
void _apiBarrelSmoke;

// Export API client and helpers
export {
	apiClient,
	api,
	createAPIClient,
	APIError,
	buildQueryString,
} from './client';
export { normalizeApiError, handleAPIError } from './error-handler';
export type { APIResponse, PaginatedResponse } from './client';

// Export configuration
export {
	API_CONFIG,
	ErrorMessages,
	SITE_STUDIO_PROXY_BASE_PATH,
	fetchConfig,
	upsertConfigItems,
	fetchFeatureFlags,
	upsertFeatureFlags,
} from './config';
export type { ConfigItem } from './config';

export {
	activateSiteStudioProxy,
	deactivateSiteStudioProxy,
	isSiteStudioProxyActive,
	rewriteSiteStudioProxyUrl,
	SITE_STUDIO_PROXY_BASE,
} from './siteStudioProxy';

// Export legacy services (for backward compatibility)
export { default as ApiService } from './ApiService';
export { default as EmperyworldService } from './EmperyworldService';
