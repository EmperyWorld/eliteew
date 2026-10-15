/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Feedback Hub submit error mapping to i18n keys.
 *
 * Invariants:
 * - Rate-limit and quota API responses map to locale-aware copy, not raw server Russian.
 *
 * Related:
 * - pages/Desktop/components/feedbackHub/mapFeedbackSubmitError.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { APIError } from '@/services/api/client';
import {
	isFeedbackBugQuotaMessage,
	isFeedbackRateLimitMessage,
	isFeedbackWishQuotaMessage,
	mapFeedbackSubmitError,
} from '../mapFeedbackSubmitError';

const t = vi.fn((key: string) => `i18n:${key}`) as unknown as Parameters<
	typeof mapFeedbackSubmitError
>[1];

describe('mapFeedbackSubmitError', () => {
	it('maps HTTP 429 to toastRateLimited', () => {
		expect(
			mapFeedbackSubmitError(new APIError('Слишком много обращений', 429), t)
		).toBe('i18n:toastRateLimited');
	});

	it('detects rate-limit message markers', () => {
		expect(isFeedbackRateLimitMessage('Too many requests')).toBe(true);
		expect(isFeedbackRateLimitMessage('Слишком много обращений')).toBe(true);
	});

	it('maps wish quota 400 to toastQuotaWishServer', () => {
		expect(
			mapFeedbackSubmitError(
				new APIError('Достигнут лимит пожеланий (5).', 400),
				t
			)
		).toBe('i18n:toastQuotaWishServer');
		expect(isFeedbackWishQuotaMessage('wish limit reached')).toBe(true);
	});

	it('maps bug quota 400 to toastQuotaBugServer', () => {
		expect(
			mapFeedbackSubmitError(
				new APIError('Достигнут лимит сообщений об ошибках (3).', 400),
				t
			)
		).toBe('i18n:toastQuotaBugServer');
		expect(isFeedbackBugQuotaMessage('issue report limit')).toBe(true);
	});

	it('maps network errors to toastSendNetworkError', () => {
		expect(mapFeedbackSubmitError(new APIError('Network Error', 0), t)).toBe(
			'i18n:toastSendNetworkError'
		);
	});

	it('falls back to toastSendError for empty messages', () => {
		expect(mapFeedbackSubmitError(new APIError('', 500), t)).toBe(
			'i18n:toastSendError'
		);
	});
});
