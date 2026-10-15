import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { type APIError } from '../../services/api/client';
import {
	UGS_GENERATION_STATUS_POLL_MS,
	ugsGenerationResultQueryOptions,
	ugsGenerationStatusQueryOptions,
} from '../../services/api/ugsQueryOptions';

export type UGSGenerationStatusValue =
	| 'queued'
	| 'pending'
	| 'processing'
	| 'retrying'
	| 'completed'
	| 'failed'
	| 'cancelled';

export interface UGSGenerationStatus {
	request_id: string;
	status: UGSGenerationStatusValue;
	progress?: number | null;
	stage?: string | null;
	progress_message?: string | null;
	estimated_completion?: string | null;
	started_at?: string | null;
	completed_at?: string | null;
	queued_at?: string | null;
	last_heartbeat_at?: string | null;
	queue_status?: string | null;
	execution_backend?: string | null;
	provider_name?: string | null;
	provider_attempt?: number | null;
	retry_count?: number | null;
	idempotency_key?: string | null;
	result?: Record<string, unknown> | null;
	error?: string | null;
	/** Set when e.g. generation_type is missing (e.g. "generation_type_not_found") */
	error_type?: string | null;
	metadata?: Record<string, unknown> | null;
}

export interface UGSGenerationResult {
	request_id: string;
	status: UGSGenerationStatusValue;
	result?: Record<string, unknown> | null;
	metadata?: Record<string, unknown>;
	started_at?: string | null;
	completed_at?: string | null;
	error?: string | null;
}

export const UGS_TERMINAL_STATUSES: UGSGenerationStatusValue[] = [
	'completed',
	'failed',
	'cancelled',
];

/** Fallback polling when SSE is not used; prefer `runUgsGenerationStream` in Hub. */

export const useUGSGenerationStatus = (
	requestId: string | undefined,
	options?: Omit<
		UseQueryOptions<UGSGenerationStatus, APIError>,
		'queryKey' | 'queryFn'
	>
): ReturnType<typeof useQuery<UGSGenerationStatus, APIError>> => {
	return useQuery<UGSGenerationStatus, APIError>({
		...ugsGenerationStatusQueryOptions<UGSGenerationStatus>(requestId),
		enabled: !!requestId,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (!status) {
				return UGS_GENERATION_STATUS_POLL_MS;
			}
			return UGS_TERMINAL_STATUSES.includes(status)
				? false
				: UGS_GENERATION_STATUS_POLL_MS;
		},
		...options,
	});
};

export const useUGSGenerationResult = (
	requestId: string | undefined,
	options?: Omit<
		UseQueryOptions<UGSGenerationResult, APIError>,
		'queryKey' | 'queryFn'
	>
): ReturnType<typeof useQuery<UGSGenerationResult, APIError>> => {
	return useQuery<UGSGenerationResult, APIError>({
		...ugsGenerationResultQueryOptions<UGSGenerationResult>(requestId),
		enabled: false,
		...options,
	});
};
