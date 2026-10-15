/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for UGS Admin v2 types edit — build type.patch payloads from form vs baseline.
 *
 * Invariants:
 * - Empty string fields mean "do not change" in multi-target mode.
 * - Single-target mode diffs against baseline so unchanged prefills are omitted.
 *
 * Related:
 * - src/features/ugs/admin-v2/components/TypesBulkEditModal.tsx
 */

import { parseJsonInput } from '@/features/ugs/shared/ugsAdminUi';
import type { GenerationTypeDTO } from '@/services/api/ugsAdmin';

export type TypesEditTriBool = '' | 'true' | 'false';

export type TypesEditFormValues = {
	displayName: string;
	category: string;
	description: string;
	provider: string;
	modelName: string;
	parametersRaw: string;
	complexity: string;
	estimatedTime: string;
	maxRetries: string;
	priority: string;
	costCredits: string;
	isActive: TypesEditTriBool;
	metadataRaw: string;
};

export type TypesEditBaseline = {
	display_name: string;
	category: string;
	description: string | null;
	provider: string;
	model_name: string | null;
	parameters: Record<string, unknown>;
	complexity: string;
	estimated_time: number;
	max_retries: number;
	priority: number;
	cost_credits: number;
	is_active: boolean;
	metadata: Record<string, unknown>;
};

export function emptyTypesEditForm(): TypesEditFormValues {
	return {
		displayName: '',
		category: '',
		description: '',
		provider: '',
		modelName: '',
		parametersRaw: '',
		complexity: '',
		estimatedTime: '',
		maxRetries: '',
		priority: '',
		costCredits: '',
		isActive: '',
		metadataRaw: '',
	};
}

export function baselineFromType(item: GenerationTypeDTO): TypesEditBaseline {
	return {
		display_name: item.display_name,
		category: item.category,
		description: item.description ?? null,
		provider: item.provider,
		model_name: item.model_name ?? null,
		parameters: (item.parameters ?? {}) as Record<string, unknown>,
		complexity: item.complexity ?? 'medium',
		estimated_time: Number(item.estimated_time ?? 60),
		max_retries: Number(item.max_retries ?? 3),
		priority: Number(item.priority ?? 5),
		cost_credits: Number(item.cost_credits ?? 0),
		is_active: !!item.is_active,
		metadata: (item.metadata ?? {}) as Record<string, unknown>,
	};
}

export function formFromBaseline(base: TypesEditBaseline): TypesEditFormValues {
	return {
		displayName: base.display_name,
		category: base.category,
		description: base.description ?? '',
		provider: base.provider,
		modelName: base.model_name ?? '',
		parametersRaw: JSON.stringify(base.parameters ?? {}, null, 2),
		complexity: base.complexity,
		estimatedTime: String(base.estimated_time),
		maxRetries: String(base.max_retries),
		priority: String(base.priority),
		costCredits: String(base.cost_credits),
		isActive: base.is_active ? 'true' : 'false',
		metadataRaw: JSON.stringify(base.metadata ?? {}, null, 2),
	};
}

function stableJson(value: Record<string, unknown>): string {
	try {
		return JSON.stringify(value ?? {});
	} catch {
		return '{}';
	}
}

export function buildTypePatch(
	form: TypesEditFormValues,
	baseline: TypesEditBaseline | null,
	invalidJsonMessage: string
): { patch: Record<string, unknown>; errors: string[] } {
	const errors: string[] = [];
	const patch: Record<string, unknown> = {};
	const single = baseline != null;

	const putStr = (
		key: string,
		raw: string,
		baselineValue: string | null | undefined
	) => {
		const next = raw.trim();
		if (!single && !next) return;
		if (single) {
			const prev = (baselineValue ?? '').trim();
			if (next === prev) return;
			patch[key] = next || null;
			return;
		}
		patch[key] = next;
	};

	const putNum = (
		key: string,
		raw: string,
		baselineValue: number | null | undefined
	) => {
		const next = raw.trim();
		if (!next) return;
		const n = Number(next);
		if (!Number.isFinite(n)) {
			errors.push(`${key}: invalid number`);
			return;
		}
		if (single && n === baselineValue) return;
		patch[key] = n;
	};

	putStr('display_name', form.displayName, baseline?.display_name);
	putStr('category', form.category, baseline?.category);
	putStr('description', form.description, baseline?.description);
	putStr('provider', form.provider, baseline?.provider);
	putStr('model_name', form.modelName, baseline?.model_name);
	putStr('complexity', form.complexity, baseline?.complexity);
	putNum('estimated_time', form.estimatedTime, baseline?.estimated_time);
	putNum('max_retries', form.maxRetries, baseline?.max_retries);
	putNum('priority', form.priority, baseline?.priority);
	putNum('cost_credits', form.costCredits, baseline?.cost_credits);

	if (form.isActive === 'true' || form.isActive === 'false') {
		const next = form.isActive === 'true';
		if (!single || next !== baseline?.is_active) {
			patch.is_active = next;
		}
	}

	const parseObjField = (raw: string, key: 'parameters' | 'metadata') => {
		const trimmed = raw.trim();
		if (!single && !trimmed) return;
		try {
			const parsed = parseJsonInput(trimmed || '{}', invalidJsonMessage);
			if (single) {
				const prev =
					key === 'parameters' ? baseline?.parameters : baseline?.metadata;
				if (stableJson(parsed) === stableJson(prev ?? {})) return;
			}
			patch[key] = parsed;
		} catch (err) {
			errors.push(
				err instanceof Error ? `${key}: ${err.message}` : `${key}: invalid JSON`
			);
		}
	};

	parseObjField(form.parametersRaw, 'parameters');
	parseObjField(form.metadataRaw, 'metadata');

	return { patch, errors };
}
