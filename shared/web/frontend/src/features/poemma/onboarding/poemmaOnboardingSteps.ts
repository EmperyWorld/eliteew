/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Onboarding wizard step metadata, validation, defaults and route helpers (P-101…P-104).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §1
 * - poemma/docs/implementation/COPY-RU.md
 */

import {
	canActivatePoemmaPeriod,
	poemmaSegmentShareTotal,
	type PoemmaCustomerSegment,
	type PoemmaOrgId,
	type PoemmaPeriodGoal,
	type PoemmaStrategyAnchor,
	type PoemmaUserId,
} from '../poemmaDomain';
import type { PoemmaRepository } from '../poemmaRepository';

export const POEMMA_ONBOARDING_STEP_COUNT = 6;

export const POEMMA_ONBOARDING_WELCOME_TITLE = 'Честная карта бизнеса';
export const POEMMA_ONBOARDING_WELCOME_SUB =
	'Без гарантий и магии. Цифры из 1С. Смысл — ваш.';

export const POEMMA_ONBOARDING_MIN_VALUES = 3;
export const POEMMA_ONBOARDING_MAX_VALUES = 5;

export type PoemmaOnboardingRoute = '/' | '/onboarding';

export interface PoemmaOnboardingSegmentDraft {
	id?: string;
	name: string;
	sharePercent: number;
}

export interface PoemmaOnboardingFormState {
	vision: string;
	mission: string;
	values: string[];
	utp: string;
	targetProfit: string;
	segments: PoemmaOnboardingSegmentDraft[];
}

export const DEFAULT_POEMMA_ONBOARDING_SEGMENTS: PoemmaOnboardingSegmentDraft[] =
	[
		{ name: 'Локальные', sharePercent: 30 },
		{ name: 'Туристы', sharePercent: 30 },
		{ name: 'B2B сети', sharePercent: 30 },
		{ name: 'Прочие', sharePercent: 10 },
	];

export function createEmptyPoemmaOnboardingForm(): PoemmaOnboardingFormState {
	return {
		vision: '',
		mission: '',
		values: ['', '', ''],
		utp: '',
		targetProfit: '',
		segments: DEFAULT_POEMMA_ONBOARDING_SEGMENTS.map((segment) => ({
			...segment,
		})),
	};
}

export function poemmaOnboardingFormFromStrategy(
	strategy: PoemmaStrategyAnchor | null,
	goal: PoemmaPeriodGoal | null,
	segments: PoemmaCustomerSegment[]
): PoemmaOnboardingFormState {
	const filledValues = strategy?.values?.filter((value) => value.trim()) ?? [];
	const values =
		filledValues.length >= POEMMA_ONBOARDING_MIN_VALUES
			? [...filledValues]
			: [
					...filledValues,
					...Array(
						Math.max(0, POEMMA_ONBOARDING_MIN_VALUES - filledValues.length)
					).fill(''),
				];

	return {
		vision: strategy?.vision ?? '',
		mission: strategy?.mission ?? '',
		values,
		utp: strategy?.utp ?? '',
		targetProfit:
			goal?.targetProfit != null && goal.targetProfit > 0
				? String(goal.targetProfit)
				: '',
		segments:
			segments.length > 0
				? segments.map((segment) => ({
						id: segment.id,
						name: segment.name,
						sharePercent: segment.sharePercent,
					}))
				: DEFAULT_POEMMA_ONBOARDING_SEGMENTS.map((segment) => ({
						...segment,
					})),
	};
}

/** P-104: пустая стратегия → онбординг (wireframes §15, API-LOCAL). */
export function isPoemmaStrategyEmpty(
	strategy: PoemmaStrategyAnchor | null | undefined
): boolean {
	if (!strategy) {
		return true;
	}
	return !strategy.vision.trim() || !strategy.mission.trim();
}

export async function resolvePoemmaHomeRoute(
	repository: Pick<PoemmaRepository, 'getStrategy'>
): Promise<PoemmaOnboardingRoute> {
	const strategy = await repository.getStrategy();
	return isPoemmaStrategyEmpty(strategy) ? '/onboarding' : '/';
}

export function poemmaOnboardingProgressLabel(step: number): string {
	const clamped = Math.min(Math.max(step, 1), POEMMA_ONBOARDING_STEP_COUNT);
	return `Шаг ${clamped} из ${POEMMA_ONBOARDING_STEP_COUNT}`;
}

export function poemmaOnboardingFilledValues(values: string[]): string[] {
	return values.map((value) => value.trim()).filter(Boolean);
}

export function validatePoemmaOnboardingStep(
	step: number,
	form: PoemmaOnboardingFormState
): string | null {
	switch (step) {
		case 1:
			return null;
		case 2: {
			if (!form.vision.trim()) {
				return 'Заполните видение';
			}
			if (!form.mission.trim()) {
				return 'Заполните миссию';
			}
			return null;
		}
		case 3: {
			const filled = poemmaOnboardingFilledValues(form.values);
			if (filled.length < POEMMA_ONBOARDING_MIN_VALUES) {
				return `Добавьте минимум ${POEMMA_ONBOARDING_MIN_VALUES} ценности`;
			}
			if (filled.length > POEMMA_ONBOARDING_MAX_VALUES) {
				return `Не больше ${POEMMA_ONBOARDING_MAX_VALUES} ценностей`;
			}
			return null;
		}
		case 4:
			return form.utp.trim() ? null : 'Заполните УТП';
		case 5: {
			const profit = Number.parseFloat(form.targetProfit.replace(/\s/g, ''));
			if (!Number.isFinite(profit) || profit <= 0) {
				return 'Укажите план прибыли больше нуля';
			}
			return null;
		}
		case 6: {
			const total = poemmaSegmentShareTotal(
				form.segments.map((segment, index) => ({
					id: segment.id ?? `draft-${index}`,
					orgId: 'draft',
					name: segment.name,
					sharePercent: segment.sharePercent,
				}))
			);
			if (total !== 100) {
				return `Сумма долей ${total}% — нужно 100%`;
			}
			const emptyName = form.segments.find((segment) => !segment.name.trim());
			if (emptyName) {
				return 'Укажите название каждого сегмента';
			}
			return null;
		}
		default:
			return null;
	}
}

export function buildPoemmaStrategyAnchor(input: {
	orgId: PoemmaOrgId;
	ownerUserId: PoemmaUserId;
	form: PoemmaOnboardingFormState;
	existing?: PoemmaStrategyAnchor | null;
}): PoemmaStrategyAnchor {
	const now = new Date().toISOString();
	return {
		orgId: input.orgId,
		vision: input.form.vision.trim(),
		mission: input.form.mission.trim(),
		values: poemmaOnboardingFilledValues(input.form.values),
		utp: input.form.utp.trim(),
		teamUnderstood: input.existing?.teamUnderstood,
		updatedAt: now,
		updatedBy: input.ownerUserId,
	};
}

export function buildPoemmaPeriodGoalFromOnboarding(
	periodId: string,
	form: PoemmaOnboardingFormState
): PoemmaPeriodGoal {
	const targetProfit = Number.parseFloat(form.targetProfit.replace(/\s/g, ''));
	return {
		periodId,
		primaryMetricType: 'profit',
		primaryMetricLabel: 'Прибыль',
		targetProfit,
	};
}

export function buildPoemmaSegmentsFromOnboarding(
	orgId: PoemmaOrgId,
	form: PoemmaOnboardingFormState
): PoemmaCustomerSegment[] {
	return form.segments.map((segment, index) => ({
		id: segment.id ?? `segment-${index}-${crypto.randomUUID()}`,
		orgId,
		name: segment.name.trim(),
		sharePercent: segment.sharePercent,
	}));
}

export function canCompletePoemmaOnboarding(
	form: PoemmaOnboardingFormState
): boolean {
	for (let step = 1; step <= POEMMA_ONBOARDING_STEP_COUNT; step += 1) {
		if (validatePoemmaOnboardingStep(step, form)) {
			return false;
		}
	}
	const goal = buildPoemmaPeriodGoalFromOnboarding('draft', form);
	return canActivatePoemmaPeriod(goal);
}
