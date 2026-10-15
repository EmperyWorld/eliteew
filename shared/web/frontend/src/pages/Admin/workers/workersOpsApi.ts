/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for Celery / RabbitMQ workers-ops snapshot and control.
 *
 * Invariants:
 * - Routes under `/api/v1/desktop/admin/workers-ops/*`.
 * - Mutating calls require emperyworld_admin on the API.
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 * - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
 */

import { api } from '../../../services/api/client';

const BASE = '/api/v1/desktop/admin/workers-ops';

export type WorkersAdminTab =
	| 'overview'
	| 'celery'
	| 'beat'
	| 'rabbitmq'
	| 'actions';

export interface WorkersOpsExpectedPool {
	id: string;
	label: string;
	container: string;
	queues: string[];
	role: string;
	online: boolean | null;
	matched_workers?: string[];
	online_reason?: string;
}

export interface WorkersOpsTaskRow {
	worker: string;
	id: string;
	name: string;
	args?: unknown;
	kwargs?: unknown;
	time_start?: unknown;
}

export interface WorkersOpsQueueDepths {
	status: string;
	error?: string | null;
	depths: Record<string, number>;
}

export interface WorkersOpsRateLimitPolicy {
	default_rate_limit: string | null;
	exempt_tasks: string[];
}

export interface WorkersOpsInspectPhases {
	essential_sec: number | null;
	detail_sec: number | null;
	detail_skipped: string[];
	reply_timeout_sec?: number;
}

export interface WorkersOpsSnapshot {
	celery: {
		status: string;
		error?: string | null;
		ping: Record<string, unknown>;
		stats: Record<string, unknown>;
		active_queues: Record<string, unknown>;
		active: WorkersOpsTaskRow[];
		reserved: WorkersOpsTaskRow[];
		scheduled: WorkersOpsTaskRow[];
		registered: Record<string, string[]>;
		workers_online: string[];
		queues: Array<{ name: string; routing_key: string }>;
		known_queue_names: string[];
		queue_depths: WorkersOpsQueueDepths;
		rate_limit_policy: WorkersOpsRateLimitPolicy;
		inspect_phases?: WorkersOpsInspectPhases;
	};
	beat: {
		health: Record<string, unknown>;
		schedule: Array<{ name: string; task: string; schedule: string }>;
	};
	rabbitmq: Record<string, unknown>;
	expected_pools: WorkersOpsExpectedPool[];
}

export interface WorkersOpsActionResponse {
	ok: boolean;
	detail: Record<string, unknown>;
}

export async function getWorkersOpsSnapshot(): Promise<WorkersOpsSnapshot> {
	return api.get<WorkersOpsSnapshot>(`${BASE}/snapshot`);
}

export async function postWorkersOpsRevoke(body: {
	task_id: string;
	terminate?: boolean;
}): Promise<WorkersOpsActionResponse> {
	return api.post<WorkersOpsActionResponse>(`${BASE}/revoke`, body);
}

export async function postWorkersOpsPurgeQueue(body: {
	queue: string;
}): Promise<WorkersOpsActionResponse> {
	return api.post<WorkersOpsActionResponse>(`${BASE}/purge-queue`, body);
}

/** Count online expected pools (true only; null/false excluded). */
export function countOnlinePools(pools: WorkersOpsExpectedPool[]): {
	online: number;
	total: number;
	unknown: number;
} {
	let online = 0;
	let unknown = 0;
	for (const p of pools) {
		if (p.online === true) online += 1;
		else if (p.online == null) unknown += 1;
	}
	return { online, total: pools.length, unknown };
}
