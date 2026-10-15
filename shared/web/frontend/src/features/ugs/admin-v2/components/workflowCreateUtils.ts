/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build workflow.create bulk operation payloads from UGS Admin v2 create-workflow form values.
 *
 * Invariants:
 * - Required: name, slug; json_body defaults to {} when empty.
 * - model_dependencies parsed from comma-separated CSV.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/WorkflowsTabV2.tsx
 */

import { parseJsonInput } from '@/features/ugs/shared/ugsAdminUi';
import type { UgsAdminV2BulkOperation } from '@/services/api/ugsAdminV2';

export type WorkflowCreateFormValues = {
	name: string;
	slug: string;
	category: string;
	description: string;
	version: string;
	estimatedTime: string;
	isActive: 'true' | 'false';
	modelDependenciesCSV: string;
	jsonBodyRaw: string;
	metadataRaw: string;
};

export function emptyWorkflowCreateForm(): WorkflowCreateFormValues {
	return {
		name: '',
		slug: '',
		category: '',
		description: '',
		version: '1',
		estimatedTime: '',
		isActive: 'true',
		modelDependenciesCSV: '',
		jsonBodyRaw: '{}',
		metadataRaw: '{}',
	};
}

function parseCsvList(raw: string): string[] {
	return raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

export function buildWorkflowCreateOperation(
	form: WorkflowCreateFormValues,
	invalidJsonMessage: string
): { operation: UgsAdminV2BulkOperation | null; errors: string[] } {
	const errors: string[] = [];
	const name = form.name.trim();
	const slug = form.slug.trim();

	if (!name) errors.push('name: required');
	if (!slug) errors.push('slug: required');

	const workflow: Record<string, unknown> = {
		name,
		slug,
		is_active: form.isActive === 'true',
	};

	const category = form.category.trim();
	if (category) workflow.category = category;

	const description = form.description.trim();
	if (description) workflow.description = description;

	if (form.version.trim()) {
		const n = Number(form.version);
		if (!Number.isFinite(n) || n < 1) {
			errors.push('version: must be >= 1');
		} else {
			workflow.version = n;
		}
	}

	if (form.estimatedTime.trim()) {
		const n = Number(form.estimatedTime);
		if (!Number.isFinite(n) || n < 0) {
			errors.push('estimated_time: invalid number');
		} else {
			workflow.estimated_time = n;
		}
	}

	const deps = parseCsvList(form.modelDependenciesCSV);
	if (deps.length) workflow.model_dependencies = deps;

	try {
		workflow.json_body = parseJsonInput(
			form.jsonBodyRaw.trim() || '{}',
			invalidJsonMessage
		);
	} catch (err) {
		errors.push(
			err instanceof Error
				? `json_body: ${err.message}`
				: 'json_body: invalid JSON'
		);
	}

	try {
		const metadata = parseJsonInput(
			form.metadataRaw.trim() || '{}',
			invalidJsonMessage
		);
		if (Object.keys(metadata).length) {
			workflow.metadata = metadata;
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
			kind: 'workflow.create',
			workflow: workflow as UgsAdminV2BulkOperation extends {
				kind: 'workflow.create';
			}
				? UgsAdminV2BulkOperation['workflow']
				: never,
		},
		errors: [],
	};
}
