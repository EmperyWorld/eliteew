/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Segment editor drafts, defaults and save mapping for /segments (P-605).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §5
 */

import {
	poemmaSegmentShareTotal,
	type PoemmaCustomerSegment,
	type PoemmaOrgId,
} from '../poemmaDomain';
import { DEFAULT_POEMMA_ONBOARDING_SEGMENTS } from '../onboarding/poemmaOnboardingSteps';

export const POEMMA_SEGMENT_SLOT_COUNT = 4;

export interface PoemmaSegmentDraft {
	id?: string;
	name: string;
	sharePercent: number;
	note: string;
}

export function createEmptyPoemmaSegmentDrafts(): PoemmaSegmentDraft[] {
	return DEFAULT_POEMMA_ONBOARDING_SEGMENTS.map((segment) => ({
		name: segment.name,
		sharePercent: segment.sharePercent,
		note: '',
	}));
}

export function poemmaSegmentDraftsFromStored(
	segments: PoemmaCustomerSegment[]
): PoemmaSegmentDraft[] {
	if (segments.length === 0) {
		return createEmptyPoemmaSegmentDrafts();
	}

	const drafts: PoemmaSegmentDraft[] = segments
		.slice(0, POEMMA_SEGMENT_SLOT_COUNT)
		.map((segment) => ({
			id: segment.id,
			name: segment.name,
			sharePercent: segment.sharePercent,
			note: segment.note ?? '',
		}));

	const defaults = DEFAULT_POEMMA_ONBOARDING_SEGMENTS;
	while (drafts.length < POEMMA_SEGMENT_SLOT_COUNT) {
		const fallback = defaults[drafts.length];
		drafts.push({
			name: fallback?.name ?? '',
			sharePercent: fallback?.sharePercent ?? 0,
			note: '',
		});
	}

	return drafts;
}

export function poemmaSegmentShareTotalFromDrafts(
	drafts: PoemmaSegmentDraft[]
): number {
	return poemmaSegmentShareTotal(
		drafts.map((draft, index) => ({
			id: draft.id ?? `draft-${index}`,
			orgId: 'draft',
			name: draft.name,
			sharePercent: draft.sharePercent,
		}))
	);
}

export function validatePoemmaSegmentsDraft(
	drafts: PoemmaSegmentDraft[]
): string | null {
	const emptyName = drafts.find((draft) => !draft.name.trim());
	if (emptyName) {
		return 'Укажите название каждого сегмента';
	}
	return null;
}

export function buildPoemmaSegmentsForSave(
	orgId: PoemmaOrgId,
	drafts: PoemmaSegmentDraft[]
): PoemmaCustomerSegment[] {
	return drafts.map((draft, index) => ({
		id: draft.id ?? `segment-${index}-${crypto.randomUUID()}`,
		orgId,
		name: draft.name.trim(),
		sharePercent: Math.min(100, Math.max(0, draft.sharePercent)),
		note: draft.note.trim() || undefined,
	}));
}

export function parsePoemmaSegmentShareInput(raw: string): number {
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}
