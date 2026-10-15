/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Builds AMKA operation-review rows and control-center counters from run detail data.
 * Keeps UI rendering thin while preserving the backend skip_step_ids / skip_operation_keys contract.
 *
 * Invariants:
 * - Review rows are derived from persisted run/step payloads only; no synthetic operation ids are sent back to API.
 * - `skip_step_ids` is used for duplicate execute steps, while `skip_section_keys` remains the coarse section-level control.
 *
 * Related:
 * - src/features/amka/AmkaView.tsx
 * - src/hooks/api/useAmka.ts
 */
import type {
	AmkaOperation,
	AmkaRun,
	AmkaRunStep,
} from '@/services/amka/marketingCabinetAmkaBridge';
import {
	readNumberField,
	readPlanTaskOptionalString,
} from '@/features/amka/amkaViewUtils';

export interface AmkaOperationReviewItem {
	key: string;
	stepId: string | null;
	sectionKey: string;
	stepTitle: string;
	operation: AmkaOperation | null;
	operationKey: string | null;
	kind: string;
	entityType: string | null;
	entityId: string | null;
	title: string;
	destructive: boolean;
	hasSources: boolean;
	expectedEffect: string | null;
	reason: string | null;
}

export interface AmkaControlCenterMetrics {
	auditFallbackRatio: number | null;
	planSource: string | null;
	planLlmStatus: string | null;
	destructiveCount: number;
	failedOrNoSaveOperations: number;
	zeroSaveSections: number;
	noEntityIdOperations: number;
	noSourceOperations: number;
	replaceCount: number;
	createCount: number;
	reconcileCandidateCount: number;
}

function readResultStatus(operation: AmkaOperation): string {
	const value =
		operation.result && typeof operation.result === 'object'
			? operation.result.status
			: null;
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function operationFailedOrNoSave(operation: AmkaOperation): boolean {
	const status = readResultStatus(operation);
	return Boolean(status) && !['completed', 'applied'].includes(status);
}

function stepSavedNothing(step: AmkaRunStep): boolean {
	if (step.stage_kind !== 'execute_section' || step.status !== 'completed') {
		return false;
	}
	const applied = Array.isArray(step.applied_entities)
		? step.applied_entities.length
		: 0;
	const after = step.metrics_after ?? {};
	const delta =
		typeof after.count_delta === 'number'
			? after.count_delta
			: typeof after.applied_count === 'number'
				? after.applied_count
				: null;
	return applied === 0 && (delta === null || delta === 0);
}

function buildPendingStepBuckets(
	steps: AmkaRunStep[]
): Map<string, AmkaRunStep[]> {
	const buckets = new Map<string, AmkaRunStep[]>();
	for (const step of steps) {
		if (step.stage_kind !== 'execute_section') continue;
		const key = String(step.section_key ?? '').trim();
		if (!key) continue;
		const current = buckets.get(key) ?? [];
		current.push(step);
		buckets.set(key, current);
	}
	for (const items of buckets.values()) {
		items.sort((a, b) => a.ordinal - b.ordinal);
	}
	return buckets;
}

export function buildAmkaOperationReview(params: {
	run: AmkaRun | null;
	steps: AmkaRunStep[];
}): {
	items: AmkaOperationReviewItem[];
	metrics: AmkaControlCenterMetrics;
} {
	const { run, steps } = params;
	const plan = run?.master_plan ?? [];
	const buckets = buildPendingStepBuckets(steps);
	const usedStepIds = new Set<string>();
	const items: AmkaOperationReviewItem[] = [];

	for (const task of plan) {
		const sectionKey = String(task.section_key || '').trim();
		const matchingStep = (buckets.get(sectionKey) ?? []).find(
			(step) => !usedStepIds.has(step.id)
		);
		if (matchingStep) {
			usedStepIds.add(matchingStep.id);
		}
		const ops = Array.isArray(task.operations) ? task.operations : [];
		if (ops.length === 0) {
			items.push({
				key: `${task.step_key}:step`,
				stepId: matchingStep?.id ?? null,
				sectionKey,
				stepTitle: task.title,
				operation: null,
				operationKey: null,
				kind:
					readPlanTaskOptionalString(task, 'execution_mode') ||
					task.write_policy ||
					'step',
				entityType: null,
				entityId: null,
				title: task.title,
				destructive: false,
				hasSources: false,
				expectedEffect: task.rationale ?? null,
				reason: task.rationale ?? null,
			});
			continue;
		}
		for (const [index, operation] of ops.entries()) {
			const operationKey = operation.operation_key?.trim() || null;
			items.push({
				key:
					operationKey ??
					`${task.step_key}:${operation.kind}:${operation.entity_id ?? index}`,
				stepId: matchingStep?.id ?? null,
				sectionKey,
				stepTitle: task.title,
				operation,
				operationKey,
				kind: operation.kind,
				entityType: operation.entity_type ?? null,
				entityId: operation.entity_id ?? null,
				title:
					operation.title ??
					operation.expected_effect ??
					operation.reason ??
					operation.kind,
				destructive: Boolean(operation.destructive),
				hasSources: Boolean(operation.source_refs?.length),
				expectedEffect: operation.expected_effect ?? null,
				reason: operation.reason ?? null,
			});
		}
	}

	const executedOperations = steps.flatMap(
		(step) => step.operation_trail ?? []
	);
	const fallbackStats =
		run?.audit_llm_stats &&
		typeof run.audit_llm_stats === 'object' &&
		!Array.isArray(run.audit_llm_stats)
			? run.audit_llm_stats
			: null;
	const auditTotal = readNumberField(fallbackStats, 'total') ?? 0;
	const auditFallback = readNumberField(fallbackStats, 'fallback') ?? 0;
	const auditFallbackRatio = auditTotal > 0 ? auditFallback / auditTotal : null;
	const strategyGraphReconcile =
		run?.final_assessment?.strategy_graph_reconcile;
	const structuredReconcileDetails =
		strategyGraphReconcile &&
		typeof strategyGraphReconcile === 'object' &&
		!Array.isArray(strategyGraphReconcile)
			? (strategyGraphReconcile as Record<string, unknown>).structured_details
			: null;
	const reconcileDetails = Array.isArray(structuredReconcileDetails)
		? (structuredReconcileDetails as Record<string, unknown>[])
		: [];

	return {
		items,
		metrics: {
			auditFallbackRatio,
			planSource: run?.plan_source ?? null,
			planLlmStatus: run?.plan_llm_status ?? null,
			destructiveCount: items.filter((item) => item.destructive).length,
			failedOrNoSaveOperations: executedOperations.filter(
				operationFailedOrNoSave
			).length,
			zeroSaveSections: steps.filter(stepSavedNothing).length,
			noEntityIdOperations: items.filter(
				(item) =>
					item.operation !== null &&
					!item.entityId &&
					['update', 'replace', 'delete', 'archive'].includes(item.kind)
			).length,
			noSourceOperations: items.filter(
				(item) => item.operation !== null && !item.hasSources
			).length,
			replaceCount: items.filter((item) => item.kind === 'replace').length,
			createCount: items.filter((item) => item.kind === 'create').length,
			reconcileCandidateCount: reconcileDetails.filter(
				(item) => item.action === 'candidate'
			).length,
		},
	};
}
