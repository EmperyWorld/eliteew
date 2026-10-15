/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Poemma ideas screens (P-401, P-402): list labels, filters, verdict validation.
 *
 * Invariants:
 * - List titles ≤5 words (marketing-cabinet-spec §3.2).
 * - Verdict save requires non-empty verdictNote when verdict is set (poemmaDomain).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §9–10
 * - src/features/poemma/poemmaDomain.ts
 */

import {
	canSetPoemmaInitiativeVerdict,
	type PoemmaInitiative,
	type PoemmaInitiativeStatus,
	type PoemmaUserRole,
	type PoemmaVerdict,
} from '../poemmaDomain';

export const POEMMA_IDEA_LIST_MAX_WORDS = 5;

export type PoemmaIdeasFilterTab = 'all' | 'testing' | 'decided';

export const POEMMA_VERDICT_LABELS: Record<PoemmaVerdict, string> = {
	go: 'Идём',
	iterate: 'Доработать',
	stop: 'Стоп',
};

export const POEMMA_INITIATIVE_STATUS_LABELS: Record<
	PoemmaInitiativeStatus,
	string
> = {
	backlog: 'Очередь',
	testing: 'Проверяем',
	decided: 'Решено',
};

export function canPoemmaRoleManageIdeas(role: PoemmaUserRole): boolean {
	return role === 'owner' || role === 'team';
}

export function canPoemmaRoleSetIdeaVerdict(role: PoemmaUserRole): boolean {
	return role === 'owner';
}

export function truncatePoemmaIdeaListTitle(title: string): string {
	const words = title.trim().split(/\s+/u).filter(Boolean);
	if (words.length <= POEMMA_IDEA_LIST_MAX_WORDS) {
		return words.join(' ');
	}
	return `${words.slice(0, POEMMA_IDEA_LIST_MAX_WORDS).join(' ')}…`;
}

export function filterPoemmaInitiativesByTab(
	initiatives: PoemmaInitiative[],
	tab: PoemmaIdeasFilterTab
): PoemmaInitiative[] {
	if (tab === 'all') {
		return initiatives;
	}
	if (tab === 'testing') {
		return initiatives.filter((item) => item.status === 'testing');
	}
	return initiatives.filter((item) => item.status === 'decided');
}

export function sortPoemmaInitiativesForList(
	initiatives: PoemmaInitiative[]
): PoemmaInitiative[] {
	const statusOrder: Record<PoemmaInitiativeStatus, number> = {
		testing: 0,
		backlog: 1,
		decided: 2,
	};
	return [...initiatives].sort((a, b) => {
		const byStatus = statusOrder[a.status] - statusOrder[b.status];
		if (byStatus !== 0) {
			return byStatus;
		}
		return a.title.localeCompare(b.title, 'ru');
	});
}

export function formatPoemmaInitiativeListStatusLine(
	initiative: PoemmaInitiative
): string {
	if (initiative.status === 'decided' && initiative.verdict) {
		const verdictLabel = POEMMA_VERDICT_LABELS[initiative.verdict];
		return `decided ✓ ${verdictLabel}`;
	}
	return initiative.status;
}

export function validatePoemmaIdeaDraft(input: {
	title: string;
	story: string;
}): string | null {
	if (!input.title.trim()) {
		return 'Укажите название';
	}
	if (!input.story.trim()) {
		return 'Опишите идею';
	}
	return null;
}

export function validatePoemmaVerdictDraft(input: {
	verdict: PoemmaVerdict | null;
	verdictNote: string;
}): string | null {
	if (!input.verdict) {
		return 'Выберите решение';
	}
	if (!input.verdictNote.trim()) {
		return 'Комментарий к решению обязателен';
	}
	return null;
}

export function buildPoemmaInitiativeWithVerdict(
	initiative: PoemmaInitiative,
	verdict: PoemmaVerdict,
	verdictNote: string
): PoemmaInitiative {
	return {
		...initiative,
		status: 'decided',
		verdict,
		verdictNote: verdictNote.trim(),
	};
}

export function buildPoemmaInitiativeForTesting(
	initiative: PoemmaInitiative
): PoemmaInitiative {
	if (initiative.status === 'testing') {
		return initiative;
	}
	return {
		...initiative,
		status: 'testing',
		verdict: undefined,
		verdictNote: undefined,
	};
}

export function canSavePoemmaInitiative(initiative: PoemmaInitiative): boolean {
	return canSetPoemmaInitiativeVerdict(initiative);
}

export function createPoemmaInitiativeId(): string {
	return `initiative-${globalThis.crypto.randomUUID()}`;
}

export function createPoemmaInitiativeDraft(input: {
	periodId: string;
	title: string;
	story: string;
	source?: string;
	segmentId?: string;
}): PoemmaInitiative {
	return {
		id: createPoemmaInitiativeId(),
		periodId: input.periodId,
		title: input.title.trim(),
		story: input.story.trim(),
		source: input.source?.trim() || undefined,
		segmentId: input.segmentId,
		status: 'backlog',
	};
}
