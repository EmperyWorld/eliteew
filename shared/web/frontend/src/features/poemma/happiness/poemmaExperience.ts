/**
 * Experience balance helpers (P-301) — threshold and inBalance from domain rules.
 */

import {
	computePoemmaInBalance,
	POEMMA_DEFAULT_EXPERIENCE_BALANCE_THRESHOLD_PERCENT,
	type PoemmaExperienceBalance,
	type PoemmaOrgId,
} from '../poemmaDomain';

export const POEMMA_DEFAULT_EXPERIENCE_THRESHOLD_PERCENT =
	POEMMA_DEFAULT_EXPERIENCE_BALANCE_THRESHOLD_PERCENT;

export function computeInBalance(
	employee: number,
	client: number,
	thresholdPercent = POEMMA_DEFAULT_EXPERIENCE_THRESHOLD_PERCENT
): boolean {
	return computePoemmaInBalance(employee, client, thresholdPercent);
}

export function clampPoemmaExperienceScore(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(100, Math.max(0, Math.round(value)));
}

export function buildPoemmaExperienceBalance(input: {
	orgId: PoemmaOrgId;
	employeeScore: number;
	clientScore: number;
	measuredAt?: string;
	thresholdPercent?: number;
}): PoemmaExperienceBalance {
	const employeeScore = clampPoemmaExperienceScore(input.employeeScore);
	const clientScore = clampPoemmaExperienceScore(input.clientScore);
	const thresholdPercent =
		input.thresholdPercent ?? POEMMA_DEFAULT_EXPERIENCE_THRESHOLD_PERCENT;

	return {
		orgId: input.orgId,
		employeeScore,
		clientScore,
		measuredAt: input.measuredAt ?? new Date().toISOString(),
		inBalance: computeInBalance(employeeScore, clientScore, thresholdPercent),
	};
}

export function resolvePoemmaExperienceStatusLabel(inBalance: boolean): string {
	return inBalance ? 'В балансе' : 'Есть разрыв';
}

export function formatPoemmaExperienceScore(score: number): string {
	return String(clampPoemmaExperienceScore(score));
}
