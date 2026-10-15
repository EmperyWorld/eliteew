/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map assistant SSE/stream error payloads to user-facing i18n strings.
 *
 * Invariants:
 * - User-visible output always goes through `t()`; raw server text only for rate-limit heuristics.
 *
 * Related:
 * - pages/Desktop/components/assistant/useAssistantMessageStream.ts
 * - pages/Desktop/services/productDesktopApi.ts
 */
import type { TFunction } from 'i18next';

export type AssistantStreamErrorMeta = {
	retryAfterSeconds?: number;
	status?: number;
};

const RATE_LIMIT_MESSAGE_MARKERS = [
	'Слишком много',
	'Too many requests',
	'rate limit',
] as const;

export function isAssistantRateLimitMessage(message: string): boolean {
	if (message === 'rate_limited') return true;
	const lower = message.toLowerCase();
	return RATE_LIMIT_MESSAGE_MARKERS.some((marker) =>
		lower.includes(marker.toLowerCase())
	);
}

export function mapAssistantStreamError(
	message: string,
	t: TFunction<'desktopUi', 'assistant'>,
	meta?: AssistantStreamErrorMeta
): string {
	if (isAssistantRateLimitMessage(message)) return t('rateLimited');
	if (message === 'network_error') {
		return meta?.status != null
			? t('streamErrors.networkErrorWithStatus', { status: meta.status })
			: t('streamErrors.networkError');
	}
	if (message === 'no_response_body') return t('streamErrors.noResponseBody');
	if (message === 'stream_error') return t('toastError');
	return message.trim() ? message : t('toastError');
}
