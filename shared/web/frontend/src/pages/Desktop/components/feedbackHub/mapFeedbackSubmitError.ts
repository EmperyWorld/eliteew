/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map Feedback Hub ticket submit errors to user-facing i18n strings.
 *
 * Invariants:
 * - Rate-limit and quota responses use i18n; raw server Russian text is not shown to EN users.
 *
 * Related:
 * - FeedbackHubComposeForm.tsx · product_desktop.py create_feedback_ticket
 */
import type { TFunction } from 'i18next';
import { APIError } from '@/services/api/client';

const RATE_LIMIT_MARKERS = ['Слишком много', 'Too many', 'rate limit'] as const;

const WISH_QUOTA_MARKERS = ['лимит пожеланий', 'wish limit'] as const;

const BUG_QUOTA_MARKERS = [
	'лимит сообщений об ошибках',
	'issue report limit',
	'bug limit',
] as const;

function messageIncludesMarker(
	message: string,
	markers: readonly string[]
): boolean {
	const lower = message.toLowerCase();
	return markers.some((marker) => lower.includes(marker.toLowerCase()));
}

export function isFeedbackRateLimitMessage(message: string): boolean {
	return messageIncludesMarker(message, RATE_LIMIT_MARKERS);
}

export function isFeedbackWishQuotaMessage(message: string): boolean {
	return messageIncludesMarker(message, WISH_QUOTA_MARKERS);
}

export function isFeedbackBugQuotaMessage(message: string): boolean {
	return messageIncludesMarker(message, BUG_QUOTA_MARKERS);
}

export function mapFeedbackSubmitError(
	error: unknown,
	t: TFunction<'desktopUi', 'feedbackHub'>
): string {
	if (error instanceof APIError) {
		if (error.statusCode === 429 || isFeedbackRateLimitMessage(error.message)) {
			return t('toastRateLimited');
		}
		if (error.statusCode === 400) {
			if (isFeedbackWishQuotaMessage(error.message)) {
				return t('toastQuotaWishServer');
			}
			if (isFeedbackBugQuotaMessage(error.message)) {
				return t('toastQuotaBugServer');
			}
		}
		if (error.isNetworkError) {
			return t('toastSendNetworkError');
		}
	}

	const fallback =
		error instanceof APIError
			? error.message
			: error instanceof Error
				? error.message
				: String(error);

	if (isFeedbackRateLimitMessage(fallback)) return t('toastRateLimited');
	if (isFeedbackWishQuotaMessage(fallback)) return t('toastQuotaWishServer');
	if (isFeedbackBugQuotaMessage(fallback)) return t('toastQuotaBugServer');

	return fallback.trim() ? fallback : t('toastSendError');
}
