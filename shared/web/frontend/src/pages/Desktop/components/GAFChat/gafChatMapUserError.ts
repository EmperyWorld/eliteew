/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map GAF Chat API and network errors to localized user-facing strings.
 *
 * Invariants:
 * - Raw backend English/Russian text is not shown when a known i18n key applies.
 *
 * Related:
 * - GafChatThreadPanel.tsx · GafChatComposerCluster.tsx · GAFChatApp.tsx
 */
import type { TFunction } from 'i18next';
import { APIError } from '@/services/api/client';

const RATE_LIMIT_MARKERS = ['Слишком много', 'Too many', 'rate limit'] as const;

export type GafChatUserErrorContext =
	| 'send'
	| 'messages'
	| 'chats'
	| 'e2ee'
	| 'attachment'
	| 'friend'
	| 'openChat'
	| 'generic';

function messageIncludesMarker(
	message: string,
	markers: readonly string[]
): boolean {
	const lower = message.toLowerCase();
	return markers.some((marker) => lower.includes(marker.toLowerCase()));
}

export function isGafChatRateLimitMessage(message: string): boolean {
	return messageIncludesMarker(message, RATE_LIMIT_MARKERS);
}

function fallbackForContext(
	t: TFunction<'gafChat'>,
	context: GafChatUserErrorContext
): string {
	switch (context) {
		case 'send':
			return t('toastSendFailed');
		case 'messages':
			return t('messagesLoadErrorFallback');
		case 'chats':
			return t('chatsLoadErrorGeneric');
		case 'e2ee':
			return t('e2eeToastActionFailed');
		case 'attachment':
			return t('toastAttachmentAcceptFailed');
		case 'friend':
			return t('friendRequestSendFailedToast');
		case 'openChat':
			return t('toastOpenChatFailed');
		default:
			return t('messagesLoadErrorFallback');
	}
}

export function mapGafChatUserError(
	error: unknown,
	t: TFunction<'gafChat'>,
	context: GafChatUserErrorContext = 'generic'
): string {
	if (error instanceof APIError) {
		const apiErr = error;
		if (
			apiErr.statusCode === 429 ||
			isGafChatRateLimitMessage(apiErr.message)
		) {
			return context === 'send'
				? t('toastSendRateLimited')
				: t('toastSendRateLimited');
		}
		if (apiErr.statusCode === 401 || apiErr.statusCode === 403) {
			return t('chatsLoadErrorAuth');
		}
		if (apiErr.statusCode === 404 && context === 'chats') {
			return t('chatsLoadError404');
		}
		if (apiErr.isNetworkError) {
			return t('chatsLoadErrorGeneric');
		}
	}

	const fallback =
		error instanceof APIError
			? error.message
			: error instanceof Error
				? error.message
				: String(error);

	if (isGafChatRateLimitMessage(fallback)) {
		return t('toastSendRateLimited');
	}

	return fallback.trim() ? fallback : fallbackForContext(t, context);
}
