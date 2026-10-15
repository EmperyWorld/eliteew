/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	createBlankCompanionWorkflowTemplate,
	EWA_COMPANION_NEW_WORKFLOW_KEY,
	formatCompanionWorkflowTemplateJson,
} from '../ewaCompanionWorkflowTemplate';

const WORKFLOW_ID_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

describe('ewaCompanionWorkflowTemplate', () => {
	it('uses sentinel key for new workflow sidebar entry', () => {
		expect(EWA_COMPANION_NEW_WORKFLOW_KEY).toBe('__new_workflow__');
	});

	it('creates valid blank template (master-plan §8.3)', () => {
		const template = createBlankCompanionWorkflowTemplate();
		expect(template.workflow_id).toMatch(WORKFLOW_ID_PATTERN);
		expect(template.version).toBe(1);
		expect(template.enabled).toBe(false);
		expect(template.execution_mode).toBe('async');
		expect(Array.isArray(template.triggers)).toBe(true);
		expect(Array.isArray(template.steps)).toBe(true);
		const steps = template.steps as Array<Record<string, unknown>>;
		expect(steps[0]?.tool_name).toBe('file_create');
		expect(steps[0]?.requires_confirm).toBe(true);
	});

	it('formatCompanionWorkflowTemplateJson returns parseable JSON', () => {
		const text = formatCompanionWorkflowTemplateJson();
		const parsed = JSON.parse(text) as Record<string, unknown>;
		expect(parsed.workflow_id).toMatch(WORKFLOW_ID_PATTERN);
		expect(text.includes('\n')).toBe(true);
	});
});
