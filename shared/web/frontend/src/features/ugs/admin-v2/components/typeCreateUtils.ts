/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build type.create bulk operation payloads from UGS Admin v2 create-type form values.
 *
 * Invariants:
 * - Required: type_key, category, display_name, provider.
 * - model_name defaults to '' when empty; parameters/metadata parse via parseJsonInput.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/TypesTabV2.tsx
 */

import { parseJsonInput } from '@/features/ugs/shared/ugsAdminUi';
import type { UgsAdminV2BulkOperation } from '@/services/api/ugsAdminV2';

export type TypeCreateFormValues = {
	typeKey: string;
	category: string;
	displayName: string;
	provider: string;
	description: string;
	modelName: string;
	parametersRaw: string;
	complexity: string;
	estimatedTime: string;
	maxRetries: string;
	priority: string;
	costCredits: string;
	isActive: 'true' | 'false';
	metadataRaw: string;
};

export function emptyTypeCreateForm(): TypeCreateFormValues {
	return {
		typeKey: '',
		category: '',
		displayName: '',
		provider: '',
		description: '',
		modelName: '',
		parametersRaw: '{}',
		complexity: 'medium',
		estimatedTime: '60',
		maxRetries: '3',
		priority: '5',
		costCredits: '0',
		isActive: 'true',
		metadataRaw: '{}',
	};
}

export function buildTypeCreateOperation(
	form: TypeCreateFormValues,
	invalidJsonMessage: string
): { operation: UgsAdminV2BulkOperation | null; errors: string[] } {
	const errors: string[] = [];
	const typeKey = form.typeKey.trim();
	const category = form.category.trim();
	const displayName = form.displayName.trim();
	const provider = form.provider.trim();

	if (!typeKey) errors.push('type_key: required');
	if (!category) errors.push('category: required');
	if (!displayName) errors.push('display_name: required');
	if (!provider) errors.push('provider: required');

	const generation_type: Record<string, unknown> = {
		type_key: typeKey,
		category,
		display_name: displayName,
		provider,
		model_name: form.modelName.trim() || '',
		is_active: form.isActive === 'true',
	};

	const description = form.description.trim();
	if (description) generation_type.description = description;

	if (form.complexity.trim()) {
		generation_type.complexity = form.complexity.trim();
	}

	if (form.estimatedTime.trim()) {
		const n = Number(form.estimatedTime);
		if (!Number.isFinite(n) || n < 0) {
			errors.push('estimated_time: invalid number');
		} else {
			generation_type.estimated_time = n;
		}
	}

	if (form.maxRetries.trim()) {
		const n = Number(form.maxRetries);
		if (!Number.isFinite(n) || n < 0) {
			errors.push('max_retries: invalid number');
		} else {
			generation_type.max_retries = n;
		}
	}

	if (form.priority.trim()) {
		const n = Number(form.priority);
		if (!Number.isFinite(n)) {
			errors.push('priority: invalid number');
		} else {
			generation_type.priority = n;
		}
	}

	if (form.costCredits.trim()) {
		const n = Number(form.costCredits);
		if (!Number.isFinite(n) || n < 0) {
			errors.push('cost_credits: invalid number');
		} else {
			generation_type.cost_credits = n;
		}
	}

	try {
		const parameters = parseJsonInput(
			form.parametersRaw.trim() || '{}',
			invalidJsonMessage
		);
		if (Object.keys(parameters).length) {
			generation_type.parameters = parameters;
		}
	} catch (err) {
		errors.push(
			err instanceof Error
				? `parameters: ${err.message}`
				: 'parameters: invalid JSON'
		);
	}

	try {
		const metadata = parseJsonInput(
			form.metadataRaw.trim() || '{}',
			invalidJsonMessage
		);
		if (Object.keys(metadata).length) {
			generation_type.metadata = metadata;
		}
	} catch (err) {
		errors.push(
			err instanceof Error
				? `metadata: ${err.message}`
				: 'metadata: invalid JSON'
		);
	}

	if (errors.length) return { operation: null, errors };

	return {
		operation: {
			kind: 'type.create',
			generation_type: generation_type as UgsAdminV2BulkOperation extends {
				kind: 'type.create';
			}
				? UgsAdminV2BulkOperation['generation_type']
				: never,
		},
		errors: [],
	};
}
