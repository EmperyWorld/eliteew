/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Builds the AMKA run start payload from AmkaView local form state.
 *
 * Invariants:
 * - Section subset, run mode, and web-search fields match AMKA-REFERENCE start contract.
 *
 * Related:
 * - useAmkaViewMutations.ts, AMKA_START_SECTION_KEYS
 */

import { AMKA_START_SECTION_KEYS } from '@/services/amka/marketingCabinetAmkaBridge';
import {
	marketingWebSearchApiFields,
	readStoredMarketingWebSearchQuality,
} from '@/pages/MarketingCabinet/marketingWebSearchQuality';

import type {
	AmkaImcFocus,
	AmkaRunMode,
} from '@/features/amka/amkaView/amkaViewTypes';

export type BuildAmkaStartPayloadInput = {
	selectedProjectId: string;
	selectedCompanyId: string;
	userInstruction: string;
	sectionToggles: Record<string, boolean>;
	runMode: AmkaRunMode;
	autoCycleCount: number;
	perStepExecution: boolean;
	imcTypeKey: string;
	imcFocus: AmkaImcFocus;
	imcMaxWait: string;
	startPresetId: string;
};

export function buildAmkaStartPayload(input: BuildAmkaStartPayloadInput) {
	const selectedSections = AMKA_START_SECTION_KEYS.filter(
		(k) => input.sectionToggles[k]
	);
	const payload: {
		project_id: string;
		company_id: string;
		scope_key: 'all_visible';
		user_instruction?: string | null;
		section_keys?: (typeof AMKA_START_SECTION_KEYS)[number][];
		imc_type_key?: string;
		imc_focus?: 'global' | 'rf' | 'mixed';
		imc_max_wait_seconds?: number;
		run_mode?: 'auto' | 'semi_auto';
		auto_cycle_count?: number;
		per_step_execution?: boolean;
		preset_id?: string;
		web_search_quality?: string;
		use_web_search?: boolean;
	} = {
		project_id: input.selectedProjectId,
		company_id: input.selectedCompanyId,
		scope_key: 'all_visible',
		user_instruction: input.userInstruction.trim() || null,
	};
	if (input.runMode === 'auto') {
		payload.run_mode = 'auto';
		payload.auto_cycle_count = Math.min(5, Math.max(1, input.autoCycleCount));
	} else if (input.perStepExecution) {
		payload.per_step_execution = true;
	}
	if (selectedSections.length < AMKA_START_SECTION_KEYS.length) {
		payload.section_keys =
			selectedSections as (typeof AMKA_START_SECTION_KEYS)[number][];
	}
	if (input.runMode === 'semi_auto') {
		const itk = input.imcTypeKey.trim();
		if (itk) payload.imc_type_key = itk;
	}
	if (input.imcFocus !== 'mixed') payload.imc_focus = input.imcFocus;
	const waitParsed = Number.parseInt(input.imcMaxWait.trim(), 10);
	if (
		input.imcMaxWait.trim() &&
		Number.isFinite(waitParsed) &&
		waitParsed >= 10
	) {
		payload.imc_max_wait_seconds = Math.min(waitParsed, 3600);
	}
	const pid = input.startPresetId.trim();
	if (pid) {
		payload.preset_id = pid;
	}
	Object.assign(
		payload,
		marketingWebSearchApiFields(readStoredMarketingWebSearchQuality())
	);
	return { payload, selectedSections };
}
