/**
 * React Query Provider
 * Centralized query client configuration with DevTools
 *
 * @version 2.0.0 - React Query v5
 * @date 2025-10-13
 */

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { API_CONFIG } from '../services/api/config';
import { logCacheInvalidation } from '../services/api/cacheInvalidationLogger';
import { handleAPIError } from '../services/api/error-handler';
import { shouldSuppressApiErrorToast } from '../services/maintenance/recoveryNotificationGuard';

/**
 * Create Query Client with optimized configuration
 */
const createQueryClient = (): QueryClient => {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				// Stale time configuration
				staleTime: API_CONFIG.cache.staleTime.default,
				gcTime: API_CONFIG.cache.cacheTime, // React Query v5: cacheTime renamed to gcTime

				// Refetch configuration
				refetchOnWindowFocus: true,
				refetchOnReconnect: true,
				refetchOnMount: true,

				// Retry configuration
				retry: (failureCount: number, error: unknown): boolean => {
					// Don't retry on 4xx errors (client errors)
					if (error && typeof error === 'object' && 'statusCode' in error) {
						const statusCode = (error as { statusCode?: number }).statusCode;
						if (
							statusCode !== undefined &&
							statusCode >= 400 &&
							statusCode < 500
						) {
							return false;
						}
					}
					// Retry up to 3 times for other errors
					return failureCount < 3;
				},
				retryDelay: (attemptIndex: number): number =>
					Math.min(1000 * 2 ** attemptIndex, 30000),

				// Network mode
				networkMode: 'online',

				// React Query v5: onError removed from queries - global handler via cache subscriber below
			},

			mutations: {
				// Retry configuration for mutations
				retry: false, // Don't retry mutations by default

				// Network mode
				networkMode: 'online',

				// Error handling
				onError: (error: unknown): void => {
					if (shouldSuppressApiErrorToast(error)) {
						return;
					}
					handleAPIError(error);
				},
			},
		},
	});

	// Global query error handler: show toast for failed queries (same as mutations)
	const toastedQueryErrors = new WeakMap<object, number>();

	client.getQueryCache().subscribe((event) => {
		if (event.type !== 'updated') {
			return;
		}
		const query = event.query;
		if (query.state.status === 'success') {
			toastedQueryErrors.delete(query);
			return;
		}
		if (query.state.status !== 'error' || query.state.error == null) {
			return;
		}
		const meta = query.meta as { showErrorToast?: boolean } | undefined;
		if (meta?.showErrorToast === false) {
			return;
		}
		if (shouldSuppressApiErrorToast(query.state.error)) {
			return;
		}
		const errorStamp = query.state.errorUpdatedAt ?? 0;
		if (toastedQueryErrors.get(query) === errorStamp) {
			return;
		}
		toastedQueryErrors.set(query, errorStamp);
		handleAPIError(query.state.error);
	});

	return client;
};

/**
 * Query Client Instance
 * Singleton instance for the entire app
 */
export const queryClient = createQueryClient();

/**
 * Query Provider Component
 */
interface QueryProviderProps {
	children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{/* DevTools removed temporarily - install @tanstack/react-query-devtools to enable */}
		</QueryClientProvider>
	);
};

/**
 * Helper: Invalidate queries by key pattern
 */
export const invalidateQueries = async (queryKey: unknown[]): Promise<void> => {
	await queryClient.invalidateQueries({ queryKey });
};

/**
 * Helper: Prefetch query
 */
export const prefetchQuery = async <T,>(
	queryKey: unknown[],
	queryFn: () => Promise<T>
): Promise<void> => {
	await queryClient.prefetchQuery({
		queryKey,
		queryFn,
	});
};

/**
 * Helper: Set query data (optimistic update)
 */
export const setQueryData = <T,>(
	queryKey: unknown[],
	updater: T | ((old: T | undefined) => T)
): void => {
	queryClient.setQueryData(queryKey, updater);
};

/**
 * Helper: Get query data
 */
export const getQueryData = <T,>(queryKey: unknown[]): T | undefined => {
	return queryClient.getQueryData(queryKey);
};

/**
 * Helper: Cancel queries (for optimistic updates)
 */
export const cancelQueries = async (queryKey: unknown[]): Promise<void> => {
	await queryClient.cancelQueries({ queryKey });
};

/**
 * Helper: Remove queries
 */
export const removeQueries = (queryKey: unknown[]): void => {
	queryClient.removeQueries({ queryKey });
};

/**
 * Helper: Reset query client (useful for logout)
 */
export const resetQueryClient = (): void => {
	logCacheInvalidation('resetQueryClient logout RQ clear');
	queryClient.clear();
};
