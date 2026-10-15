/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Defines frontend AMKA artifact types owned by the standalone feature boundary.
 * Marketing Cabinet API re-exports these types while AMKA moves out of page-local contracts.
 *
 * Invariants:
 * - Types stay additive and tolerant of older backend responses.
 * - Projection fields mirror backend `standalone_projection` and core projection artifacts.
 *
 * Related:
 * - src/pages/MarketingCabinet/marketingCabinetApi/index.ts
 * - shared/api/services/amka_core/projection.py
 * - shared/api/services/amka_core/marketing_core_bridge.py
 */
export interface AmkaPulseArtifact {
	summary: string;
	changed: string[];
	preserved: string[];
	doubts: string[];
	agreements: string[];
	no_change_reason?: string | null;
	next_safe_step?: string | null;
	metrics?: Record<string, number>;
}

export interface AmkaStandaloneProjection {
	driver_key: string;
	domain_profile: string;
	subject: {
		subject_id?: string;
		run_id?: string;
		project_id?: string;
		company_id?: string;
		display_name?: string;
		metadata?: Record<string, unknown>;
	};
	status?: string | null;
	current_stage?: string | null;
	stage_counts: Record<string, number>;
	step_status_counts: Record<string, number>;
	task_status_counts?: Record<string, number>;
	trace_events: Array<{
		stage: string;
		event: string;
		message?: string;
		payload?: Record<string, unknown>;
	}>;
	contract: Record<string, boolean>;
}

export interface AmkaCoreAlignmentTaskPreview {
	task_key: string;
	title: string;
	risk: string;
	operations_count: number;
}

/** Response from GET .../amka/runs/:id/core-alignment (AmkaCoreEngine, execute=false, persisted plan). */
export interface AmkaCoreAlignmentResponse {
	status: string;
	pulse: Record<string, unknown>;
	policy: Record<string, unknown>;
	projection: Partial<AmkaStandaloneProjection> & Record<string, unknown>;
	observations: Record<string, unknown>;
	/** Normalized AmkaCoreEngine trace timeline (same shape as projection.trace_events). */
	traces?: Array<{
		stage: string;
		event: string;
		message?: string;
		payload?: Record<string, unknown>;
	}>;
	task_preview: AmkaCoreAlignmentTaskPreview[];
	task_count: number;
}
