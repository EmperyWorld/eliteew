/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for UGS operator queue snapshot (`GET /api/v1/ugs/admin/queue-ops`).
 *
 * Invariants:
 * - Requires UGS admin role; errors propagate to React Query callers.
 * - DTOs come from the UGS OpenAPI pilot via `schemas.ts` (no hand-rolled SLO overlay).
 *
 * Related:
 * - services/api/ugs/schemas.ts
 * - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md
 */

import { createAPIClient } from '../client';
import type {
	UgsQueueOpsHintSchema,
	UgsQueueOpsOperatorSloSchema,
	UgsQueueOpsPostgresSectionSchema,
	UgsQueueOpsRabbitSectionSchema,
	UgsQueueOpsSnapshotSchema,
	UgsQueueOpsWorkerTuningSchema,
} from './schemas';

const client = createAPIClient({ baseURL: '/api/v1/ugs/admin' });

export type UgsQueueOpsSnapshot = UgsQueueOpsSnapshotSchema;
export type UgsQueueOpsOperatorSlo = UgsQueueOpsOperatorSloSchema;
export type UgsQueueOpsHint = UgsQueueOpsHintSchema;
export type UgsQueueOpsPostgresSection = UgsQueueOpsPostgresSectionSchema;
export type UgsQueueOpsRabbitSection = UgsQueueOpsRabbitSectionSchema;
export type UgsQueueOpsWorkerTuning = UgsQueueOpsWorkerTuningSchema;

export type UgsQueueOpsStaleCandidates = NonNullable<
	NonNullable<UgsQueueOpsPostgresSection['stale_candidates']>
>;

export type UgsQueueOpsRabbitQueue = NonNullable<
	NonNullable<UgsQueueOpsRabbitSection['queues']>[number]
>;

export type UgsQueueOpsRedisLeases = NonNullable<
	NonNullable<UgsQueueOpsSnapshot['redis']>['ugs_worker_leases']
>;

export type UgsQueueOpsStaleHorizons = NonNullable<
	NonNullable<UgsQueueOpsWorkerTuning['stale_horizons']>
>;

function toFiniteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value)
		? value
		: undefined;
}

function normalizeStaleCandidates(
	raw: unknown
): UgsQueueOpsStaleCandidates | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return undefined;
	}
	const data = raw as Record<string, unknown>;
	const pendingOrphan = toFiniteNumber(
		data.pending_orphan ?? data.stale_pending_orphaned
	);
	const pendingInQueue = toFiniteNumber(
		data.pending_in_queue ?? data.stale_pending_queue_timeout
	);
	const processing = toFiniteNumber(
		data.processing ?? data.stale_processing_timeout
	);
	const total =
		toFiniteNumber(data.total) ??
		(pendingOrphan ?? 0) + (pendingInQueue ?? 0) + (processing ?? 0);
	return {
		pending_orphan: pendingOrphan,
		pending_in_queue: pendingInQueue,
		processing,
		total,
	};
}

export function normalizeUgsQueueOpsSnapshot(
	snapshot: UgsQueueOpsSnapshot
): UgsQueueOpsSnapshot {
	const staleCandidates = normalizeStaleCandidates(
		snapshot.postgres?.stale_candidates
	);
	if (!staleCandidates) {
		return snapshot;
	}
	return {
		...snapshot,
		postgres: {
			...snapshot.postgres,
			stale_candidates: staleCandidates,
		},
	};
}

export async function fetchUgsQueueOpsSnapshot(): Promise<UgsQueueOpsSnapshot> {
	const { data } = await client.get<UgsQueueOpsSnapshot>('/queue-ops');
	return normalizeUgsQueueOpsSnapshot(data);
}
