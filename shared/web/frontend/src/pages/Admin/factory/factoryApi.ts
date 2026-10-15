/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for Gen/Forge factory intentions (Wave F5–F7 / G3).
 *
 * Invariants:
 * - Routes under `/api/v1/desktop/admin/factory/*`.
 * - `api.get`/`api.post` return response body — do not unwrap `.data` again.
 *
 * Related:
 * - `pages/Admin/factory/FactoryAdminPanel.tsx`
 * - documentation/platform/docker-re_doc/ADMIN-FACTORY-OPS.md
 */

import { api } from '../../../services/api/client';

const BASE = '/api/v1/desktop/admin/factory';

export type FactoryStatus =
	| 'pending'
	| 'running'
	| 'paused'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type FactoryStage =
	| 'queued'
	| 'plan'
	| 'implement'
	| 'verify'
	| 'fix'
	| 'done';

export interface FactoryIntention {
	id: string;
	title: string;
	pack_stems: string[];
	status: FactoryStatus;
	stage: FactoryStage;
	attempt: number;
	fix_loops: number;
	pause_reason: string | null;
	design_path: string | null;
	report_path: string | null;
	verify_status: string | null;
	checkpoint: Record<string, unknown>;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface FactoryStatusSnapshot {
	schema_version: number;
	enabled: boolean;
	autonomous: boolean;
	async_jobs?: boolean;
	/** Wave F7/G3 config-driven assembly (Gate T∧C∧S). Default OFF. */
	assembly: boolean;
	/** Wave G3 — exposed for operator kill/autonomous safety. */
	max_fix_loops?: number;
	celery_queue?: string;
	cli_hint: string;
}

export interface FactoryAssemblyEvaluateResult {
	schema_version: number;
	assembly: boolean;
	result: {
		verdict: string;
		passed: boolean;
		tc_passed?: boolean;
		gate_t: { status: string; detail: string };
		gate_c: {
			status: string;
			detail: string;
			active_packs: string[];
			inactive_packs: string[];
		};
		gate_s?: {
			status: string;
			detail: string;
			advisory?: boolean;
		};
		pack_stems: string[];
		authoritative: boolean;
	};
}

export interface FactoryIntentionList {
	schema_version: number;
	items: FactoryIntention[];
	count: number;
}

export interface FactoryKillAllResult {
	schema_version: number;
	mode: 'cancel' | 'pause';
	reason: string;
	paused: Array<{ id: string; status: string }>;
	cancelled: Array<{ id: string; status: string }>;
	skipped: Array<{ id: string; status: string; reason: string }>;
	affected: number;
}

export async function getFactoryStatus(): Promise<FactoryStatusSnapshot> {
	return api.get<FactoryStatusSnapshot>(`${BASE}/status`);
}

export async function evaluateFactoryAssembly(body: {
	pack_stems?: string[];
	intent?: string;
}): Promise<FactoryAssemblyEvaluateResult> {
	return api.post<FactoryAssemblyEvaluateResult>(
		`${BASE}/assembly/evaluate`,
		body
	);
}

export async function listFactoryIntentions(): Promise<FactoryIntentionList> {
	return api.get<FactoryIntentionList>(`${BASE}/intentions`);
}

export async function killAllFactoryIntentions(body?: {
	mode?: 'cancel' | 'pause';
	reason?: string;
}): Promise<FactoryKillAllResult> {
	return api.post<FactoryKillAllResult>(
		`${BASE}/intentions/kill-all`,
		body ?? {}
	);
}

export async function enqueueFactoryIntention(body: {
	title: string;
	pack_stems?: string[];
	run_ticks?: number;
}): Promise<{ schema_version: number; item: FactoryIntention }> {
	return api.post<{ schema_version: number; item: FactoryIntention }>(
		`${BASE}/intentions`,
		body
	);
}

export async function pauseFactoryIntention(
	id: string
): Promise<{ schema_version: number; item: FactoryIntention }> {
	return api.post<{ schema_version: number; item: FactoryIntention }>(
		`${BASE}/intentions/${encodeURIComponent(id)}/pause`,
		{}
	);
}

export async function resumeFactoryIntention(
	id: string
): Promise<{ schema_version: number; item: FactoryIntention }> {
	return api.post<{ schema_version: number; item: FactoryIntention }>(
		`${BASE}/intentions/${encodeURIComponent(id)}/resume`,
		{}
	);
}

export async function tickFactoryIntention(
	id: string
): Promise<{ schema_version: number; item: FactoryIntention }> {
	return api.post<{ schema_version: number; item: FactoryIntention }>(
		`${BASE}/intentions/${encodeURIComponent(id)}/tick`,
		{}
	);
}

export async function cancelFactoryIntention(
	id: string
): Promise<{ schema_version: number; item: FactoryIntention }> {
	return api.post<{ schema_version: number; item: FactoryIntention }>(
		`${BASE}/intentions/${encodeURIComponent(id)}/cancel`,
		{}
	);
}
