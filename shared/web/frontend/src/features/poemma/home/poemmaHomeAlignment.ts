/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Home map block B checklist — five owner-facing alignment items (P-108).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframe-home.md §6
 * - poemma/docs/implementation/domain-model.ts (buildAlignmentChecklist)
 */

import {
	buildPoemmaAlignmentChecklist,
	poemmaSegmentShareTotal,
	type PoemmaCustomerSegment,
	type PoemmaPeriod,
	type PoemmaPeriodGoal,
	type PoemmaStrategyAnchor,
} from '../poemmaDomain';

export type PoemmaHomeAlignmentKey =
	| 'strategy'
	| 'utp'
	| 'goal'
	| 'segments'
	| 'period';

export interface PoemmaHomeAlignmentItem {
	key: PoemmaHomeAlignmentKey;
	label: string;
	done: boolean;
}

export const POEMMA_HOME_ALIGNMENT_TOTAL = 5;

function isPoemmaStrategyFilled(
	strategy: Partial<PoemmaStrategyAnchor>
): boolean {
	return !!strategy.vision?.trim() && !!strategy.mission?.trim();
}

function isPoemmaSegmentsFilled(segments: PoemmaCustomerSegment[]): boolean {
	if (segments.length === 0) {
		return false;
	}
	return poemmaSegmentShareTotal(segments) === 100;
}

function isPoemmaPeriodReady(period: PoemmaPeriod | null): boolean {
	return period?.status === 'active';
}

/**
 * Five checklist rows for «Всё сходится?»: стратегия, УТП, цель, сегменты, период.
 * Reuses domain goal/UTP rules from `buildPoemmaAlignmentChecklist` where applicable.
 */
export function buildPoemmaHomeAlignmentChecklist(input: {
	strategy: Partial<PoemmaStrategyAnchor>;
	goal: Partial<PoemmaPeriodGoal>;
	segments: PoemmaCustomerSegment[];
	period: PoemmaPeriod | null;
}): PoemmaHomeAlignmentItem[] {
	const domainItems = buildPoemmaAlignmentChecklist(
		input.strategy,
		input.goal,
		!!input.strategy.teamUnderstood
	);

	const utpDone = domainItems.find((item) => item.key === 'utp')?.done ?? false;
	const goalDone =
		domainItems.find((item) => item.key === 'goal')?.done ?? false;

	return [
		{
			key: 'strategy',
			label: 'Стратегия',
			done: isPoemmaStrategyFilled(input.strategy),
		},
		{
			key: 'utp',
			label: 'УТП',
			done: utpDone,
		},
		{
			key: 'goal',
			label: 'Цель',
			done: goalDone,
		},
		{
			key: 'segments',
			label: 'Сегменты',
			done: isPoemmaSegmentsFilled(input.segments),
		},
		{
			key: 'period',
			label: 'Период',
			done: isPoemmaPeriodReady(input.period),
		},
	];
}

export function summarizePoemmaHomeAlignment(
	items: PoemmaHomeAlignmentItem[]
): { done: number; total: number } {
	const done = items.filter((item) => item.done).length;
	return { done, total: items.length || POEMMA_HOME_ALIGNMENT_TOTAL };
}
