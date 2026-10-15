/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Poemma strategy / UTP screens (P-105, P-106).
 *
 * Invariants:
 * - Values list: 3–5 non-empty strings for owner save.
 * - Team brief: at most five sentences for non-owner read view.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §2–3
 * - src/features/poemma/poemmaDomain.ts
 */

import {
	buildPoemmaAlignmentChecklist,
	type PoemmaPeriodGoal,
	type PoemmaStrategyAnchor,
	type PoemmaUserRole,
} from '../poemmaDomain';

export const POEMMA_STRATEGY_MIN_VALUES = 3;
export const POEMMA_STRATEGY_MAX_VALUES = 5;

export type PoemmaStrategyView = 'main' | 'utp';

export function isPoemmaStrategyOwner(role: PoemmaUserRole): boolean {
	return role === 'owner';
}

export function canPoemmaTeamAcknowledgeStrategy(
	role: PoemmaUserRole
): boolean {
	return role === 'team';
}

export function resolvePoemmaStrategyView(hash: string): PoemmaStrategyView {
	return hash === '#utp' ? 'utp' : 'main';
}

export function createEmptyPoemmaStrategy(
	orgId: string,
	updatedBy: string
): PoemmaStrategyAnchor {
	return {
		orgId,
		vision: '',
		mission: '',
		values: ['', '', ''],
		utp: '',
		teamUnderstood: false,
		updatedAt: new Date().toISOString(),
		updatedBy,
	};
}

export function normalizePoemmaStrategyValues(values: string[]): string[] {
	return values.map((value) => value.trim()).filter(Boolean);
}

export function ensurePoemmaStrategyValueSlots(values: string[]): string[] {
	const normalized = normalizePoemmaStrategyValues(values);
	const slots = normalized.length ? [...normalized] : ['', '', ''];
	while (slots.length < POEMMA_STRATEGY_MIN_VALUES) {
		slots.push('');
	}
	return slots.slice(0, POEMMA_STRATEGY_MAX_VALUES);
}

const SENTENCE_SPLIT = /(?<=[.!?…])\s+/u;

export function splitPoemmaSentences(text: string): string[] {
	return text
		.split(SENTENCE_SPLIT)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
}

/** Краткая выжимка для команды — не более пяти предложений. */
export function buildPoemmaTeamBrief(
	strategy: Partial<PoemmaStrategyAnchor>
): string {
	const sentences: string[] = [];
	for (const block of [strategy.utp, strategy.mission, strategy.vision]) {
		if (!block?.trim()) {
			continue;
		}
		for (const sentence of splitPoemmaSentences(block.trim())) {
			sentences.push(sentence);
			if (sentences.length >= 5) {
				return sentences.join(' ');
			}
		}
	}
	return sentences.join(' ');
}

export function countPoemmaAlignmentProgress(
	strategy: Partial<PoemmaStrategyAnchor>,
	goal: Partial<PoemmaPeriodGoal>
): { done: number; total: number } {
	const items = buildPoemmaAlignmentChecklist(
		strategy,
		goal,
		!!strategy.teamUnderstood
	);
	const done = items.filter((item) => item.done).length;
	return { done, total: items.length };
}

export function isPoemmaStrategyEmpty(
	strategy: Partial<PoemmaStrategyAnchor> | null
): boolean {
	if (!strategy) {
		return true;
	}
	const values = normalizePoemmaStrategyValues(strategy.values ?? []);
	return (
		!strategy.vision?.trim() &&
		!strategy.mission?.trim() &&
		values.length === 0 &&
		!strategy.utp?.trim()
	);
}

export function validatePoemmaStrategyDraft(input: {
	vision: string;
	mission: string;
	values: string[];
	utp: string;
	requireUtp?: boolean;
}): string | null {
	if (!input.vision.trim()) {
		return 'Заполните видение';
	}
	if (!input.mission.trim()) {
		return 'Заполните миссию';
	}
	const values = normalizePoemmaStrategyValues(input.values);
	if (values.length < POEMMA_STRATEGY_MIN_VALUES) {
		return `Добавьте минимум ${POEMMA_STRATEGY_MIN_VALUES} ценности`;
	}
	if (values.length > POEMMA_STRATEGY_MAX_VALUES) {
		return `Не больше ${POEMMA_STRATEGY_MAX_VALUES} ценностей`;
	}
	if (input.requireUtp && !input.utp.trim()) {
		return 'Заполните УТП';
	}
	return null;
}

export function mergePoemmaStrategySave(
	base: PoemmaStrategyAnchor,
	patch: Partial<
		Pick<
			PoemmaStrategyAnchor,
			'vision' | 'mission' | 'values' | 'utp' | 'teamUnderstood'
		>
	>,
	updatedBy: string
): PoemmaStrategyAnchor {
	return {
		...base,
		...patch,
		values: patch.values
			? normalizePoemmaStrategyValues(patch.values)
			: base.values,
		updatedAt: new Date().toISOString(),
		updatedBy,
	};
}
