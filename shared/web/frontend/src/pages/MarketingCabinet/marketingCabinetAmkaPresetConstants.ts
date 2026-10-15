/**
 * Должно совпадать с бэкендом: `AMKA_ACTIONABLE_SECTIONS`, `AMKA_PLAN_EXECUTION_MODES`
 * (amka_service.py, amka_analysis_registry.py, amka_preset_merge.py).
 */
import { AMKA_START_SECTION_KEYS } from './marketingCabinetAmkaDeepLink';

const AMKA_AUDIT_ONLY_SECTION_KEYS = new Set([
	'overview',
	'companies',
	'projects',
	'team',
	'dashboard',
]);

export const AMKA_PRESET_ACTIONABLE_SECTION_KEYS =
	AMKA_START_SECTION_KEYS.filter((k) => !AMKA_AUDIT_ONLY_SECTION_KEYS.has(k));

/** Допустимые якоря вставки: любой видимый раздел плана. */
export const AMKA_PRESET_INSERT_ANCHOR_KEYS = [...AMKA_START_SECTION_KEYS];

export const AMKA_PLAN_EXECUTION_MODE_OPTIONS = [
	'mutation_service',
	'project_generate_async',
	'imc_research',
	'marketing_tool_agent',
	'desktop_ensemble',
] as const;

export type AmkaPlanExecutionModeOption =
	(typeof AMKA_PLAN_EXECUTION_MODE_OPTIONS)[number];

/** Blueprint template hints for `desktop_ensemble` plan tasks (backend: amka_ensemble_mapping). */
export const AMKA_ENSEMBLE_TEMPLATE_HINT_OPTIONS = [
	'marketing_brief_v1',
	'research_plan_v1',
	'campaign_plan_v1',
	'business_plan_v1',
] as const;
