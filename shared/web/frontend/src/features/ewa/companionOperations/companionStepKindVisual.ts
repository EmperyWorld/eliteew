/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map companion task ``step_kind`` (+ status) to user-facing icon names for step timelines (U4.3).
 *
 * Invariants:
 * - Completed steps use static success glyph (never animated processing).
 * - Unknown kinds fall back to a static progress glyph for non-terminal status.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationStepTimeline.tsx
 */

import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';

const STEP_KIND_ICON: Record<string, EwaIconId> = {
	lyrics: 'icon-ewa-brain',
	'generate-style': 'icon-pulse',
	generate_style: 'icon-pulse',
	generate: 'icon-pulse',
	music_generation: 'icon-pulse',
	music_generation_xl_base: 'icon-pulse',
	music_generation_pipeline_v2: 'icon-pulse',
	music_generation_pipeline_xl_base: 'icon-pulse',
	image_generation: 'icon-ewa-analytics',
	presentation_generation: 'icon-ewa-dashboard',
	presentation_generation_pipeline: 'icon-ewa-dashboard',
	catalog_list: 'icon-ewa-dashboard',
	document_insert: 'icon-ewa-dashboard',
	call_expert_chat: 'icon-ewa-brain',
	expert_chat: 'icon-ewa-brain',
	file_create: 'icon-ewa-dashboard',
	file_save_text: 'icon-ewa-dashboard',
	file_open: 'icon-ewa-dashboard',
	llm_summarize: 'icon-pulse',
	document_extractor: 'icon-ewa-analytics',
};

export function companionStepKindIcon(
	stepKind: string | null | undefined,
	status?: string | null
): EwaIconId {
	const st = (status || '').trim().toLowerCase();
	if (st === 'completed' || st === 'done' || st === 'success') {
		return 'icon-success';
	}
	if (st === 'failed' || st === 'error') {
		return 'icon-error';
	}
	const kind = (stepKind || '').trim().toLowerCase();
	if (!kind) return 'icon-processing';
	return STEP_KIND_ICON[kind] ?? 'icon-processing';
}
