/**
 * Pure helpers for /period-close (§15, P-606).
 */

import type { PoemmaInitiative, PoemmaPeriodReview } from '../poemmaDomain';

export function createEmptyPoemmaPeriodReview(
	periodId: string
): PoemmaPeriodReview {
	return {
		periodId,
		whatWorked: '',
		whatFailed: '',
		decisions: ['', '', ''],
		publishedToTeam: false,
	};
}

export function buildPoemmaInitiativeVerdictSummary(
	initiatives: PoemmaInitiative[]
): string {
	const go = initiatives.filter((item) => item.verdict === 'go').length;
	const stop = initiatives.filter((item) => item.verdict === 'stop').length;
	const iterate = initiatives.filter(
		(item) => item.verdict === 'iterate'
	).length;

	const parts: string[] = [];
	if (go > 0) {
		parts.push(`${go} go`);
	}
	if (iterate > 0) {
		parts.push(`${iterate} доработать`);
	}
	if (stop > 0) {
		parts.push(`${stop} stop`);
	}

	if (parts.length === 0) {
		return 'Идеи: вердиктов пока нет';
	}

	return `Идеи: ${parts.join(' · ')}`;
}

export function validatePoemmaPeriodCloseDecisions(
	decisions: [string, string, string]
): string | null {
	const filled = decisions.map((item) => item.trim()).filter(Boolean);
	if (filled.length < 3) {
		return 'Заполните три решения на следующий период';
	}
	return null;
}

export function mergePoemmaPeriodReviewDraft(
	base: PoemmaPeriodReview,
	input: {
		whatWorked: string;
		whatFailed: string;
		decisions: [string, string, string];
		profitPlan?: number;
		profitFact?: number;
	}
): PoemmaPeriodReview {
	return {
		...base,
		whatWorked: input.whatWorked,
		whatFailed: input.whatFailed,
		decisions: input.decisions,
		profitPlan: input.profitPlan,
		profitFact: input.profitFact,
	};
}
