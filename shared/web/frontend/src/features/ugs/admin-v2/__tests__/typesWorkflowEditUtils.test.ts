/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS Admin v2 type/workflow full-edit patch builders.
 *
 * Invariants:
 * - Single-target diffs omit unchanged prefills.
 * - Invalid JSON surfaces as client errors, not silent empty objects.
 *
 * Related:
 * - src/features/ugs/admin-v2/components/typesBulkEditUtils.ts
 * - src/features/ugs/admin-v2/components/workflowEditUtils.ts
 */

import { describe, expect, it } from 'vitest';

import {
	baselineFromType,
	buildTypePatch,
	emptyTypesEditForm,
	formFromBaseline,
} from '../components/typesBulkEditUtils';
import {
	baselineFromWorkflow,
	buildWorkflowPatch,
	formFromWorkflowBaseline,
} from '../components/workflowEditUtils';
import {
	buildTypeCreateOperation,
	emptyTypeCreateForm,
} from '../components/typeCreateUtils';
import {
	buildWorkflowCreateOperation,
	emptyWorkflowCreateForm,
} from '../components/workflowCreateUtils';
import {
	buildAllowlistPatch,
	buildModelRoutesReplaceOperation,
} from '../components/modelRoutesUtils';
import type {
	ComfyUIWorkflowDTO,
	GenerationTypeDTO,
} from '@/services/api/ugsAdmin';

function makeType(
	overrides: Partial<GenerationTypeDTO> = {}
): GenerationTypeDTO {
	return {
		id: 'type-1',
		type_key: 'text_chat',
		category: 'text',
		display_name: 'Text chat',
		description: 'desc',
		provider: 'llama',
		model_name: null,
		parameters: { temperature: 0.2 },
		complexity: 'medium',
		estimated_time: 60,
		max_retries: 3,
		priority: 5,
		cost_credits: 1,
		is_active: true,
		metadata: { a: 1 },
		created_at: null,
		updated_at: null,
		...overrides,
	} as GenerationTypeDTO;
}

function makeWorkflow(
	overrides: Partial<ComfyUIWorkflowDTO> = {}
): ComfyUIWorkflowDTO {
	return {
		id: 'wf-1',
		name: 'Demo',
		slug: 'demo',
		category: 'image',
		description: 'd',
		json_body: { '1': { class_type: 'LoadImage', inputs: {} } },
		model_dependencies: ['ckpt.safetensors'],
		metadata: { k: true },
		estimated_time: 120,
		version: 1,
		is_active: true,
		created_by: null,
		created_at: null,
		updated_at: null,
		...overrides,
	} as ComfyUIWorkflowDTO;
}

describe('buildTypePatch', () => {
	it('omits unchanged single-target prefills', () => {
		const base = baselineFromType(makeType());
		const form = formFromBaseline(base);
		const { patch, errors } = buildTypePatch(form, base, 'bad json');
		expect(errors).toEqual([]);
		expect(patch).toEqual({});
	});

	it('includes changed scalar and JSON fields', () => {
		const base = baselineFromType(makeType());
		const form = {
			...formFromBaseline(base),
			displayName: 'Renamed',
			priority: '9',
			parametersRaw: '{"temperature":0.7}',
			isActive: 'false' as const,
		};
		const { patch, errors } = buildTypePatch(form, base, 'bad json');
		expect(errors).toEqual([]);
		expect(patch).toMatchObject({
			display_name: 'Renamed',
			priority: 9,
			parameters: { temperature: 0.7 },
			is_active: false,
		});
	});

	it('multi-target mode only patches filled fields', () => {
		const form = {
			...emptyTypesEditForm(),
			provider: 'comfyui',
			costCredits: '2.5',
		};
		const { patch, errors } = buildTypePatch(form, null, 'bad json');
		expect(errors).toEqual([]);
		expect(patch).toEqual({ provider: 'comfyui', cost_credits: 2.5 });
	});

	it('rejects invalid parameters JSON', () => {
		const base = baselineFromType(makeType());
		const form = { ...formFromBaseline(base), parametersRaw: '{nope' };
		const { errors } = buildTypePatch(form, base, 'bad json');
		expect(errors.some((e) => e.includes('parameters'))).toBe(true);
	});
});

describe('buildWorkflowPatch', () => {
	it('omits unchanged prefills', () => {
		const base = baselineFromWorkflow(makeWorkflow());
		const form = formFromWorkflowBaseline(base);
		const { patch, setActive, errors } = buildWorkflowPatch(
			form,
			base,
			'bad json'
		);
		expect(errors).toEqual([]);
		expect(patch).toEqual({});
		expect(setActive).toBeNull();
	});

	it('patches json_body, deps, and set_active', () => {
		const base = baselineFromWorkflow(makeWorkflow());
		const form = {
			...formFromWorkflowBaseline(base),
			jsonBodyRaw: '{"2":{"class_type":"SaveImage","inputs":{}}}',
			modelDependenciesCSV: 'a.safetensors, b.safetensors',
			isActive: 'false' as const,
			name: 'Demo 2',
		};
		const { patch, setActive, errors } = buildWorkflowPatch(
			form,
			base,
			'bad json'
		);
		expect(errors).toEqual([]);
		expect(patch.name).toBe('Demo 2');
		expect(patch.model_dependencies).toEqual([
			'a.safetensors',
			'b.safetensors',
		]);
		expect(patch.json_body).toEqual({
			'2': { class_type: 'SaveImage', inputs: {} },
		});
		expect(setActive).toBe(false);
	});
});

describe('buildTypeCreateOperation', () => {
	it('builds type.create with defaults and empty model_name', () => {
		const form = {
			...emptyTypeCreateForm(),
			typeKey: 'new_type',
			category: 'text',
			displayName: 'New type',
			provider: 'llama',
		};
		const { operation, errors } = buildTypeCreateOperation(form, 'bad json');
		expect(errors).toEqual([]);
		expect(operation).toMatchObject({
			kind: 'type.create',
			generation_type: {
				type_key: 'new_type',
				category: 'text',
				display_name: 'New type',
				provider: 'llama',
				model_name: '',
				is_active: true,
			},
		});
	});

	it('requires core fields', () => {
		const { operation, errors } = buildTypeCreateOperation(
			emptyTypeCreateForm(),
			'bad json'
		);
		expect(operation).toBeNull();
		expect(errors.length).toBeGreaterThan(0);
	});
});

describe('buildWorkflowCreateOperation', () => {
	it('builds workflow.create with json_body default', () => {
		const form = {
			...emptyWorkflowCreateForm(),
			name: 'Demo',
			slug: 'demo-slug',
		};
		const { operation, errors } = buildWorkflowCreateOperation(
			form,
			'bad json'
		);
		expect(errors).toEqual([]);
		expect(operation).toMatchObject({
			kind: 'workflow.create',
			workflow: {
				name: 'Demo',
				slug: 'demo-slug',
				json_body: {},
				is_active: true,
			},
		});
	});
});

describe('modelRoutesUtils', () => {
	it('buildAllowlistPatch parses CSV', () => {
		expect(buildAllowlistPatch('a, b ,c')).toEqual({
			global_default_model: null,
			provider_defaults: {},
			category_defaults: {},
			domain_defaults: {},
			type_overrides: {},
			request_model_override_allowlist: ['a', 'b', 'c'],
		});
	});

	it('buildModelRoutesReplaceOperation validates JSON object', () => {
		const { operation, errors } = buildModelRoutesReplaceOperation(
			'{not json',
			'bad json'
		);
		expect(operation).toBeNull();
		expect(errors).toEqual(['bad json']);
	});
});
