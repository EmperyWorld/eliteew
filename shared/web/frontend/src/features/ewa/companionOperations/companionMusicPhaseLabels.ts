/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Human phase labels for XL Base / Turbo music pipeline stages (U4.4).
 *
 * Invariants:
 * - Stage indices are 1-based; out-of-range returns empty string.
 *
 * Related:
 * - companionOperationsUi.ts ``MUSIC_PIPELINE_STAGE_COUNT``
 */

import type { TFunction } from 'i18next';

const PHASE_KEYS = [
	'ewaCompanion.musicPhaseLyrics',
	'ewaCompanion.musicPhaseStyle',
	'ewaCompanion.musicPhaseGeneration',
	'ewaCompanion.musicPhaseFinalize',
] as const;

export function musicPipelinePhaseLabel(
	stageIndex: number,
	t: TFunction<'marketing', undefined>
): string {
	if (!Number.isFinite(stageIndex) || stageIndex < 1) return '';
	const idx =
		Math.min(PHASE_KEYS.length, Math.max(1, Math.round(stageIndex))) - 1;
	return t(PHASE_KEYS[idx]);
}

export function musicPipelinePhaseFromProgress(
	current: number,
	total: number,
	t: TFunction<'marketing', undefined>
): string {
	if (total <= 0) return '';
	const stage = Math.max(1, Math.min(current + 1, total));
	return musicPipelinePhaseLabel(stage, t);
}
