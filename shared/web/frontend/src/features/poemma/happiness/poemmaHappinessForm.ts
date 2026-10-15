/**
 * Happiness screen helpers — signal labels, validation, ACL (P-303, P-306).
 */

import type {
	PoemmaCustomerSegment,
	PoemmaHappinessSignal,
	PoemmaHappinessSignalType,
	PoemmaUserRole,
} from '../poemmaDomain';
import { clampPoemmaExperienceScore } from './poemmaExperience';

export const POEMMA_HAPPINESS_SIGNAL_TYPE_LABELS: Record<
	PoemmaHappinessSignalType,
	string
> = {
	review: 'Отзыв',
	complaint: 'Жалоба',
	recommendation: 'Рекомендация',
	repeat_purchase: 'Повтор',
};

export const POEMMA_HAPPINESS_POSITIVE_TYPES: PoemmaHappinessSignalType[] = [
	'review',
	'recommendation',
	'repeat_purchase',
];

export const POEMMA_HAPPINESS_NEGATIVE_TYPES: PoemmaHappinessSignalType[] = [
	'complaint',
];

export function isPoemmaHappinessOwner(role: PoemmaUserRole): boolean {
	return role === 'owner';
}

export function createPoemmaHappinessSignalId(): string {
	return `happiness-${globalThis.crypto.randomUUID()}`;
}

export function parsePoemmaExperienceScoreInput(raw: string): number | null {
	const normalized = raw.replace(/\s/g, '').replace(',', '.');
	if (!normalized) {
		return null;
	}
	const value = Number(normalized);
	if (!Number.isFinite(value)) {
		return null;
	}
	return clampPoemmaExperienceScore(value);
}

export function validatePoemmaHappinessSignalDraft(input: {
	text: string;
}): string | null {
	if (!input.text.trim()) {
		return 'Напишите текст отзыва';
	}
	return null;
}

export function resolvePoemmaHappinessSegmentLabel(
	segmentId: string | undefined,
	segments: PoemmaCustomerSegment[]
): string | null {
	if (!segmentId) {
		return null;
	}
	return segments.find((segment) => segment.id === segmentId)?.name ?? null;
}

export function formatPoemmaHappinessListDate(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) {
		return '';
	}
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
	}).format(date);
}

export function formatPoemmaHappinessSignalLine(
	signal: PoemmaHappinessSignal,
	segments: PoemmaCustomerSegment[]
): { dateLabel: string; text: string; segmentLabel: string | null } {
	return {
		dateLabel: formatPoemmaHappinessListDate(signal.createdAt),
		text: signal.text.trim(),
		segmentLabel: resolvePoemmaHappinessSegmentLabel(
			signal.segmentId,
			segments
		),
	};
}
