/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fill optional nested AMKA operator-config sections from
 * `AMKA_OPERATOR_CONFIG_V1_DEFAULT` so Builder form reads/spreads stay NonNullable.
 *
 * Invariants:
 * - Does not invent fields beyond the OpenAPI section shapes already in the DEFAULT.
 * - Merge order: DEFAULT base → stored/partial overlay (runtime `??` / spread parity).
 *
 * Related:
 * - src/features/amka/AmkaBuilderView.tsx
 * - src/features/amka/AmkaBuilderStageForm.tsx
 * - src/pages/MarketingCabinet/marketingCabinetApi/index.ts
 */
import {
	AMKA_OPERATOR_CONFIG_V1_DEFAULT,
	type AmkaOperatorConfigV1,
} from '@/services/amka/marketingCabinetAmkaBridge';

type BaselineAudit = NonNullable<AmkaOperatorConfigV1['baseline_audit']>;
type SectionLlmAudit = NonNullable<AmkaOperatorConfigV1['section_llm_audit']>;
type MasterPlan = NonNullable<AmkaOperatorConfigV1['master_plan']>;
type Execute = NonNullable<AmkaOperatorConfigV1['execute']>;
type FinalAssessment = NonNullable<AmkaOperatorConfigV1['final_assessment']>;

/** Operator config with every nested stage section present (Builder-safe). */
export type AmkaOperatorConfigV1Normalized = {
	schema_version: number;
	baseline_audit: BaselineAudit;
	section_llm_audit: SectionLlmAudit;
	master_plan: MasterPlan;
	execute: Execute;
	final_assessment: FinalAssessment;
};

const BASELINE_FALLBACK: BaselineAudit = { extra_prompt_suffix: '' };

const SECTION_LLM_FALLBACK: SectionLlmAudit = {
	enabled: true,
	delay_ms: null,
	parallelism: null,
	require_work_needed_quotes: true,
	extra_prompt_instruction: '',
};

const MASTER_PLAN_FALLBACK: MasterPlan = {
	llm_enabled: true,
	max_tokens: null,
	extra_prompt_instruction: '',
	retry_on_parse_failure: false,
	repair_json_on_parse_failure: false,
};

const EXECUTE_FALLBACK: Execute = {
	max_wait_seconds: null,
	exclude_recent_imc_type_keys: false,
	exclude_recent_imc_type_keys_limit: 3,
	desktop_ensemble_enabled: true,
	ensemble_fallback_to_tool_agent: true,
};

const FINAL_FALLBACK: FinalAssessment = {
	llm_enabled: true,
	max_prompt_chars: null,
	extra_prompt_instruction: '',
};

/**
 * Ensure nested stage sections are defined for form equality and patches.
 * Missing sections are filled from DEFAULT (same values Builder already used at runtime).
 */
export function normalizeAmkaOperatorConfigV1(
	config: AmkaOperatorConfigV1
): AmkaOperatorConfigV1Normalized {
	const d = AMKA_OPERATOR_CONFIG_V1_DEFAULT;
	return {
		schema_version: config.schema_version ?? d.schema_version ?? 1,
		baseline_audit: {
			...BASELINE_FALLBACK,
			...(d.baseline_audit ?? {}),
			...(config.baseline_audit ?? {}),
		},
		section_llm_audit: {
			...SECTION_LLM_FALLBACK,
			...(d.section_llm_audit ?? {}),
			...(config.section_llm_audit ?? {}),
		},
		master_plan: {
			...MASTER_PLAN_FALLBACK,
			...(d.master_plan ?? {}),
			...(config.master_plan ?? {}),
		},
		execute: {
			...EXECUTE_FALLBACK,
			...(d.execute ?? {}),
			...(config.execute ?? {}),
		},
		final_assessment: {
			...FINAL_FALLBACK,
			...(d.final_assessment ?? {}),
			...(config.final_assessment ?? {}),
		},
	};
}
