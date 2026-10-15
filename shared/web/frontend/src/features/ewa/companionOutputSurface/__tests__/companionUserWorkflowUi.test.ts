/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for user workflow UI helpers.
 *
 * Invariants:
 * - Helper tests stay pure and do not call workflow APIs.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/companionUserWorkflowUi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_USER_WORKFLOW_TEMPLATES,
	buildWorkflowPreviewSteps,
	duplicateWorkflowName,
	groupWorkflowWarningsByStep,
	isCompanionUserWorkflowDagV2,
	mergeCompanionUserWorkflowRows,
	stepsFromWorkflowDefinition,
	workflowGraphUnitCount,
	workflowPriorStepIndexes,
	workflowStepOutputPlaceholder,
	workflowCatalogAllowedToolNames,
	workflowToolArgsSummary,
	workflowToolCategory,
} from '@/features/ewa/companionOutputSurface/companionUserWorkflowUi';
import type { CompanionUserWorkflow } from '@/services/ewa/companionUserWorkflowsApi';

describe('companionUserWorkflowUi', () => {
	it('parses definition steps and strips user_line from args', () => {
		const steps = stepsFromWorkflowDefinition({
			steps: [
				{
					tool_name: 'theme_set',
					args_template: { theme: 'dark', user_line: '{{turn.user_line}}' },
				},
			],
		});
		expect(steps).toHaveLength(1);
		expect(steps[0]?.tool_name).toBe('theme_set');
		expect(steps[0]?.args_template).toEqual({ theme: 'dark' });
	});

	it('ships starter templates for marketing, docs, files, and myth', () => {
		expect(COMPANION_USER_WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(10);
		const ids = new Set(COMPANION_USER_WORKFLOW_TEMPLATES.map((row) => row.id));
		expect(ids.has('marketing_launch_kit')).toBe(true);
		expect(ids.has('docs_weekly_brief')).toBe(true);
		expect(ids.has('files_pdf_to_notes')).toBe(true);
		expect(ids.has('myth_world_chain')).toBe(true);
		for (const template of COMPANION_USER_WORKFLOW_TEMPLATES) {
			expect(template.steps.length).toBeGreaterThanOrEqual(2);
			expect(template.steps.length).toBeLessThanOrEqual(6);
		}
	});

	it('builds duplicate name with suffix', () => {
		expect(duplicateWorkflowName('Утро', true)).toBe('Утро (копия)');
		expect(duplicateWorkflowName('Morning', false)).toBe('Morning (copy)');
	});

	it('keeps a just-saved optimistic row visible until server list catches up', () => {
		const saved = {
			id: 'wf-new',
			principal_id: 'p1',
			name: 'Saved now',
			enabled: true,
			definition_json: { steps: [] },
			trigger_json: { type: 'phrase', patterns: ['go'] },
			version: 1,
			created_at: null,
			updated_at: null,
		} satisfies CompanionUserWorkflow;

		expect(mergeCompanionUserWorkflowRows([], saved)).toEqual([saved]);
		expect(mergeCompanionUserWorkflowRows([saved], saved)).toEqual([saved]);
	});

	it('categorizes tools and summarizes arguments for builder palette/preview', () => {
		expect(workflowToolCategory('music_generation_xl_base')).toBe('music');
		expect(workflowToolCategory('image_generation')).toBe('images');
		expect(workflowToolCategory('file_create')).toBe('files');
		expect(workflowToolCategory('catalog_list')).toBe('catalog');
		expect(workflowToolCategory('app_open')).toBe('windows');
		expect(workflowToolCategory('llm_summarize')).toBe('content');
		expect(workflowToolCategory('pdf_parser')).toBe('files');
		expect(workflowToolCategory('vision_analyze')).toBe('images');
		expect(workflowToolArgsSummary({ theme: 'dark', count: 2 })).toBe(
			'theme: dark · count: 2'
		);
	});

	it('lists allowed tool names from the live catalog', () => {
		expect(
			workflowCatalogAllowedToolNames([
				{
					name: 'theme_set',
					title_ru: 'Тема',
					title_en: 'Theme',
					description_ru: '',
					description_en: '',
					async_step: false,
					requires_confirm: false,
					fields: [],
				},
				{
					name: '  ',
					title_ru: '',
					title_en: '',
					description_ru: '',
					description_en: '',
					async_step: false,
					requires_confirm: false,
					fields: [],
				},
			])
		).toEqual(['theme_set']);
	});

	it('builds step output placeholders for linked steps', () => {
		expect(workflowStepOutputPlaceholder(0)).toBe('{{steps.0.output.reply}}');
		expect(workflowPriorStepIndexes(2)).toEqual([0, 1]);
		expect(workflowPriorStepIndexes(0)).toEqual([]);
	});

	it('builds preview steps and groups warnings by step', () => {
		const preview = buildWorkflowPreviewSteps(
			[
				{
					tool_name: 'theme_set',
					args_template: { theme: 'dark' },
					step_kind: 'tool',
					title_ru: '',
					title_en: '',
				},
			],
			[
				{
					name: 'theme_set',
					title_ru: 'Тема',
					title_en: 'Theme',
					description_ru: '',
					description_en: '',
					async_step: false,
					requires_confirm: false,
				},
			],
			false
		);
		expect(preview[0]?.title).toBe('Theme');
		expect(preview[0]?.argsSummary).toBe('theme: dark');

		const grouped = groupWorkflowWarningsByStep([
			'step_1_missing_recommended:theme',
			'duplicate_trigger_phrase',
		]);
		expect(grouped.get(1)).toEqual(['step_1_missing_recommended:theme']);
		expect(grouped.get(null)).toEqual(['duplicate_trigger_phrase']);
	});

	it('detects DAG v2 schema and counts nodes vs steps', () => {
		expect(
			isCompanionUserWorkflowDagV2({
				definition_json: { schema_version: 2, nodes: [{ id: 'a' }] },
			})
		).toBe(true);
		expect(
			isCompanionUserWorkflowDagV2({
				definition_json: { steps: [{ tool_name: 'theme_set' }] },
			})
		).toBe(false);
		expect(
			workflowGraphUnitCount({
				schema_version: 2,
				nodes: [{ id: 'a' }, { id: 'b' }],
			})
		).toBe(2);
		expect(
			workflowGraphUnitCount({
				steps: [{ tool_name: 'theme_set' }],
			})
		).toBe(1);
	});
});
