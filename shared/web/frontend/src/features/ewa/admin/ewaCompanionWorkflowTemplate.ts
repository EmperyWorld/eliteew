/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Blank action workflow JSON template for EWA companion admin «New workflow» (master-plan §8.3).
 *
 * Invariants:
 * - ``workflow_id`` matches ``^[a-z][a-z0-9_]{2,63}$`` (CompanionWorkflowDefinitionV1).
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md
 */

/** Sidebar / editor sentinel — not a real ``workflow_id``. */
export const EWA_COMPANION_NEW_WORKFLOW_KEY = '__new_workflow__';

export function createBlankCompanionWorkflowTemplate(): Record<
	string,
	unknown
> {
	return {
		workflow_id: 'my_workflow_v1',
		version: 1,
		title_ru: 'Новый workflow',
		title_en: 'New workflow',
		description_ru: 'Опишите сценарий для оператора',
		description_en: 'Describe the scenario for operators',
		enabled: false,
		execution_mode: 'async',
		env_gate: 'EWA_COMPANION_WF_MY_WORKFLOW_V1',
		tags: [],
		triggers: [
			{
				type: 'regex',
				pattern: '(?i)замените_триггер_фразой',
			},
		],
		steps: [
			{
				step_key: 'step_one',
				kind: 'tool',
				tool_name: 'file_create',
				requires_confirm: true,
				title_ru: 'Шаг 1',
				title_en: 'Step 1',
				args_template: { user_line: '{{turn.user_line}}' },
			},
		],
	};
}

export function formatCompanionWorkflowTemplateJson(
	template: Record<string, unknown> = createBlankCompanionWorkflowTemplate()
): string {
	return JSON.stringify(template, null, 2);
}
