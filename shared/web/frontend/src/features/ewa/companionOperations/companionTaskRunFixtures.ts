/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Factory helpers for companion task run/step rows aligned with OpenAPI `CompanionTaskRunOut`.
 *
 * Invariants:
 * - Defaults include required OpenAPI fields (`execution_mode`, `run_revision`, step payloads).
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import type {
	EwaCompanionTaskRun,
	EwaCompanionTaskStep,
} from '@/services/ewa/ewaCompanionChatApi';

export function makeCompanionTaskRun(
	overrides: Partial<EwaCompanionTaskRun> &
		Pick<EwaCompanionTaskRun, 'id' | 'status'>
): EwaCompanionTaskRun {
	return {
		principal_id: 'p1',
		intent_kind: 'music_generation_background',
		user_message: 'test',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 1,
		created_at: null,
		updated_at: null,
		completed_at: null,
		...overrides,
	};
}

export function makeCompanionTaskStep(
	overrides: Partial<EwaCompanionTaskStep> &
		Pick<EwaCompanionTaskStep, 'step_kind' | 'status' | 'title'>
): EwaCompanionTaskStep {
	return {
		id: 'step-1',
		run_id: 'run-1',
		step_index: 0,
		input_payload: {},
		output_payload: {},
		error_payload: {},
		created_at: null,
		updated_at: null,
		completed_at: null,
		...overrides,
	};
}
