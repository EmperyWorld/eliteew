/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import type { EwaCompanionWorkflowValidateResponse } from '../ewaCompanionAdminApi';
import {
	isWorkflowEditorValidated,
	parseWorkflowEditorJson,
	workflowEditorFingerprint,
} from '../ewaCompanionWorkflowEditorState';

const okValidation: EwaCompanionWorkflowValidateResponse = {
	ok: true,
	workflow_id: 'demo_v1',
	version: 1,
	step_count: 1,
	tool_names: ['file_create'],
	errors: [],
	warnings: [],
};

describe('ewaCompanionWorkflowEditorState', () => {
	it('requires validation fingerprint to match current editor text', () => {
		const text = '{ "workflow_id": "demo_v1" }';
		const fp = workflowEditorFingerprint(text);
		expect(isWorkflowEditorValidated(text, okValidation, fp)).toBe(true);
		expect(isWorkflowEditorValidated(`${text}\n`, okValidation, fp)).toBe(true);
		expect(isWorkflowEditorValidated(`${text} `, okValidation, 'other')).toBe(
			false
		);
		expect(
			isWorkflowEditorValidated(text, { ...okValidation, ok: false }, fp)
		).toBe(false);
	});

	it('parseWorkflowEditorJson rejects invalid JSON', () => {
		expect(parseWorkflowEditorJson('not json')).toBeNull();
		expect(parseWorkflowEditorJson('[]')).toBeNull();
		expect(parseWorkflowEditorJson('{"workflow_id":"x"}')).toEqual({
			workflow_id: 'x',
		});
	});
});
