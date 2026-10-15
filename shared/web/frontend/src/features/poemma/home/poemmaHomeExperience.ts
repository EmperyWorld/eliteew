/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Home block C — «Опыт совпал?» view model (P-304).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframe-home.md §7
 * - src/features/poemma/happiness/poemmaExperience.ts
 */

import {
	computeInBalance,
	formatPoemmaExperienceScore,
	resolvePoemmaExperienceStatusLabel,
} from '../happiness/poemmaExperience';
import type {
	PoemmaDataSource,
	PoemmaExperienceBalance,
	PoemmaNpsSnapshot,
} from '../poemmaDomain';

const POEMMA_HOME_NPS_SOURCE_LABELS: Record<PoemmaDataSource, string> = {
	'1c': 'из 1С',
	manual: 'вручную',
	import: 'импорт',
};

export type PoemmaHomeExperienceMode = 'filled' | 'empty';

export interface PoemmaHomeExperienceView {
	mode: PoemmaHomeExperienceMode;
	statusLabel: string | null;
	employeeScore: number | null;
	clientScore: number | null;
	inBalance: boolean;
	npsLine: string | null;
}

export function hasPoemmaHomeExperienceData(
	balance: PoemmaExperienceBalance | null
): boolean {
	if (!balance) {
		return false;
	}
	return balance.employeeScore > 0 || balance.clientScore > 0;
}

export function formatPoemmaHomeNpsLine(snapshot: PoemmaNpsSnapshot): string {
	const source = POEMMA_HOME_NPS_SOURCE_LABELS[snapshot.source];
	return `NPS ${Math.round(snapshot.score)} · ${source}`;
}

export function getPoemmaHomeExperienceBarWidth(score: number): number {
	return Math.min(100, Math.max(0, Math.round(score)));
}

export function buildPoemmaHomeExperienceView(input: {
	balance: PoemmaExperienceBalance | null;
	nps: PoemmaNpsSnapshot | null;
	thresholdPercent: number;
}): PoemmaHomeExperienceView {
	const balance = input.balance;
	if (!hasPoemmaHomeExperienceData(balance) || !balance) {
		return {
			mode: 'empty',
			statusLabel: null,
			employeeScore: null,
			clientScore: null,
			inBalance: false,
			npsLine: input.nps ? formatPoemmaHomeNpsLine(input.nps) : null,
		};
	}

	const inBalance = computeInBalance(
		balance.employeeScore,
		balance.clientScore,
		input.thresholdPercent
	);

	return {
		mode: 'filled',
		statusLabel: resolvePoemmaExperienceStatusLabel(inBalance),
		employeeScore: balance.employeeScore,
		clientScore: balance.clientScore,
		inBalance,
		npsLine: input.nps ? formatPoemmaHomeNpsLine(input.nps) : null,
	};
}

export function formatPoemmaHomeExperienceScoreLabel(score: number): string {
	return formatPoemmaExperienceScore(score);
}
