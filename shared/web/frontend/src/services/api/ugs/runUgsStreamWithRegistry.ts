/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared UGS SSE stream helpers: registry-backed wrapper and optional React Query cache merge.
 *
 * Invariants:
 * - All long-running UGS streams register in `ugsActiveStreamRegistry` for Hub poll backoff.
 * - Cache patch runs only when both `queryClient` and `seed` are provided.
 *
 * Related:
 * - services/api/ugs/runUgsGenerationStream.ts
 * - services/api/ugs/stream.ts
 */

import type { QueryClient } from '@tanstack/react-query';

import type { JsonObject } from '@/types/common';

import {
	beginUgsActiveStream,
	endUgsActiveStream,
} from './ugsActiveStreamRegistry';
import {
	patchUgsHubTasksFromStream,
	type UgsTaskStreamSeed,
} from './ugsHubTaskCacheFacade';
import {
	streamUgsGeneration,
	type UGSStreamCallbacks,
	type UGSStreamEventPayload,
} from './stream';

export interface RunUgsStreamBody {
	type_key?: string;
	input_data?: JsonObject;
	priority?: number;
	idempotency_key?: string;
	project_id?: string;
	company_id?: string;
	[key: string]: unknown;
}

export interface RunUgsStreamWithRegistryOptions {
	queryClient?: QueryClient;
	seed?: UgsTaskStreamSeed;
	callbacks?: UGSStreamCallbacks;
}

/**
 * Stream UGS generation with active-stream registry and optional React Query cache merge.
 */
export async function runUgsStreamWithRegistry(
	streamUrl: string,
	body: RunUgsStreamBody | Record<string, unknown>,
	options: RunUgsStreamWithRegistryOptions = {}
): Promise<Record<string, unknown>> {
	const { queryClient, seed, callbacks } = options;

	const onProgress = (payload: UGSStreamEventPayload): void => {
		if (queryClient && seed) {
			patchUgsHubTasksFromStream(queryClient, payload, seed);
		}
		callbacks?.onProgress?.(payload);
	};

	beginUgsActiveStream();
	try {
		return await streamUgsGeneration(streamUrl, body, {
			...callbacks,
			onStarted: (requestId, payload) => {
				onProgress({ ...payload, request_id: requestId });
				callbacks?.onStarted?.(requestId, payload);
			},
			onProgress,
			onEvent: (event) => {
				if (typeof event.data.request_id === 'string') {
					onProgress(event.data);
				}
				callbacks?.onEvent?.(event);
			},
		});
	} finally {
		endUgsActiveStream();
	}
}
