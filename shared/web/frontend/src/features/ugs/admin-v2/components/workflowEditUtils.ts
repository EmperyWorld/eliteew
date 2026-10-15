/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for UGS Admin v2 workflow full editor — build workflow.patch from form vs baseline.
 *
 * Invariants:
 * - slug is immutable (not in ComfyUIWorkflowUpdate).
 * - Empty multi-mode fields are omitted; single mode diffs against baseline.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/WorkflowsTabV2.tsx
 */

import { parseJsonInput } from '@/features/ugs/shared/ugsAdminUi';
import type { ComfyUIWorkflowDTO } from '@/services/api/ugsAdmin';

export type WorkflowEditTriBool = '' | 'true' | 'false';

export type WorkflowEditBaseline = {
	name: string;
	category: string | null;
	description: string | null;
	json_body: Record<string, unknown>;
	model_dependencies: string[];
	metadata: Record<string, unknown>;
	estimated_time: number | null;
	version: number;
	is_active: boolean;
};

export type WorkflowEditFormValues = {
	name: string;
	category: string;
	description: string;
	version: string;
	estimatedTime: string;
	modelDependenciesCSV: string;
	jsonBodyRaw: string;
	metadataRaw: string;
	isActive: WorkflowEditTriBool;
};

export function baselineFromWorkflow(
	item: ComfyUIWorkflowDTO
): WorkflowEditBaseline {
	return {
		name: item.name,
		category: item.category ?? null,
		description: item.description ?? null,
		json_body: (item.json_body ?? {}) as Record<string, unknown>,
		model_dependencies: [...(item.model_dependencies ?? [])],
		metadata: (item.metadata ?? {}) as Record<string, unknown>,
		estimated_time:
			item.estimated_time == null ? null : Number(item.estimated_time),
		version: Number(item.version ?? 1),
		is_active: !!item.is_active,
	};
}

export function formFromWorkflowBaseline(
	base: WorkflowEditBaseline
): WorkflowEditFormValues {
	return {
		name: base.name,
		category: base.category ?? '',
		description: base.description ?? '',
		version: String(base.version),
		estimatedTime:
			base.estimated_time == null ? '' : String(base.estimated_time),
		modelDependenciesCSV: (base.model_dependencies ?? []).join(', '),
		jsonBodyRaw: JSON.stringify(base.json_body ?? {}, null, 2),
		metadataRaw: JSON.stringify(base.metadata ?? {}, null, 2),
		isActive: base.is_active ? 'true' : 'false',
	};
}

function stableJson(value: Record<string, unknown>): string {
	try {
		return JSON.stringify(value ?? {});
	} catch {
		return '{}';
	}
}

function parseCsvList(raw: string): string[] {
	return raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

export function buildWorkflowPatch(
	form: WorkflowEditFormValues,
	baseline: WorkflowEditBaseline,
	invalidJsonMessage: string
): {
	patch: Record<string, unknown>;
	setActive: boolean | null;
	errors: string[];
} {
	const errors: string[] = [];
	const patch: Record<string, unknown> = {};

	const nextName = form.name.trim();
	if (nextName && nextName !== baseline.name) patch.name = nextName;

	const nextCategory = form.category.trim();
	if (nextCategory !== (baseline.category ?? '')) {
		patch.category = nextCategory || null;
	}

	const nextDesc = form.description.trim();
	if (nextDesc !== (baseline.description ?? '')) {
		patch.description = nextDesc || null;
	}

	if (form.version.trim()) {
		const n = Number(form.version);
		if (!Number.isFinite(n) || n < 1) {
			errors.push('version: must be >= 1');
		} else if (n !== baseline.version) {
			patch.version = n;
		}
	}

	if (form.estimatedTime.trim()) {
		const n = Number(form.estimatedTime);
		if (!Number.isFinite(n) || n < 0) {
			errors.push('estimated_time: invalid number');
		} else if (n !== (baseline.estimated_time ?? null)) {
			patch.estimated_time = n;
		}
	}

	const nextDeps = parseCsvList(form.modelDependenciesCSV);
	const prevDeps = baseline.model_dependencies ?? [];
	if (nextDeps.join('\0') !== prevDeps.join('\0')) {
		patch.model_dependencies = nextDeps;
	}

	try {
		const parsed = parseJsonInput(
			form.jsonBodyRaw.trim() || '{}',
			invalidJsonMessage
		);
		if (stableJson(parsed) !== stableJson(baseline.json_body ?? {})) {
			patch.json_body = parsed;
		}
	} catch (err) {
		errors.push(
			err instanceof Error
				? `json_body: ${err.message}`
				: 'json_body: invalid JSON'
		);
	}

	try {
		const parsed = parseJsonInput(
			form.metadataRaw.trim() || '{}',
			invalidJsonMessage
		);
		if (stableJson(parsed) !== stableJson(baseline.metadata ?? {})) {
			patch.metadata = parsed;
		}
	} catch (err) {
		errors.push(
			err instanceof Error
				? `metadata: ${err.message}`
				: 'metadata: invalid JSON'
		);
	}

	let setActive: boolean | null = null;
	if (form.isActive === 'true' || form.isActive === 'false') {
		const next = form.isActive === 'true';
		if (next !== baseline.is_active) setActive = next;
	}

	return { patch, setActive, errors };
}
