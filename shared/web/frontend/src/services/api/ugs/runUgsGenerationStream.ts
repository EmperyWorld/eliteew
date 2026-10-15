/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start UGS generation via POST `/generate/stream` and push SSE updates into React Query.
 *
 * Invariants:
 * - Registers active stream in `ugsActiveStreamRegistry` for dashboard poll backoff.
 * - Terminal events patch task cache; caller may still invalidate stats once.
 *
 * Related:
 * - components/UGSHub.tsx
 * - services/api/ugs/runUgsStreamWithRegistry.ts
 */

import type { QueryClient } from '@tanstack/react-query';

import type { JsonObject } from '@/types/common';

import { API_CONFIG } from '../config';
import {
	patchUgsHubTasksFromStream,
	type UgsTaskStreamSeed,
} from './ugsHubTaskCacheFacade';
import { runUgsStreamWithRegistry } from './runUgsStreamWithRegistry';
import type { UgsGenerationRequestCreateSchema } from './schemas';

const UGS_GENERATE_STREAM_URL = `${API_CONFIG.ugsBaseURL}/generate/stream`;

export type RunUgsGenerationStreamInput = Omit<
	UgsGenerationRequestCreateSchema,
	'input_data' | 'type_key'
> & {
	type_key: string;
	input_data: JsonObject;
};

export interface RunUgsGenerationStreamOptions {
	queryClient: QueryClient;
	seed: UgsTaskStreamSeed;
}

export interface RunUgsGenerationStreamResult {
	requestId: string;
	result: Record<string, unknown>;
}

export async function runUgsGenerationStream(
	body: RunUgsGenerationStreamInput,
	options: RunUgsGenerationStreamOptions
): Promise<RunUgsGenerationStreamResult> {
	const { queryClient, seed } = options;
	let requestId: string | undefined;

	const result = await runUgsStreamWithRegistry(
		UGS_GENERATE_STREAM_URL,
		{
			type_key: body.type_key,
			input_data: body.input_data,
			priority: body.priority ?? 5,
			...(body.idempotency_key
				? { idempotency_key: body.idempotency_key }
				: {}),
			...(body.project_id ? { project_id: body.project_id } : {}),
			...(body.company_id ? { company_id: body.company_id } : {}),
		},
		{
			queryClient,
			seed,
			callbacks: {
				onStarted: (id) => {
					requestId = id;
				},
				onEvent: ({ data }) => {
					if (typeof data.request_id === 'string') {
						requestId = data.request_id;
					}
				},
			},
		}
	);

	const resolvedId =
		requestId ??
		(typeof result.request_id === 'string' ? result.request_id : undefined);
	if (!resolvedId) {
		throw new Error('UGS stream finished without request_id');
	}

	patchUgsHubTasksFromStream(queryClient, {
		request_id: resolvedId,
		status: 'completed',
		result: result as Record<string, unknown>,
	});

	return { requestId: resolvedId, result };
}
