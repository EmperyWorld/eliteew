/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Classify stream-lock release API errors for Desktop AI Chat operator toasts.
 *
 * Invariants:
 * - 404 with "chat not found" is distinct from missing backend route support.
 *
 * Related:
 * - DesktopAiChatApp.tsx handleClearStreamLock
 * - api/desktopChatClient.ts releaseDesktopAiChatStreamLock
 */

import { APIError } from '../../services/api/client';

export type StreamLockClearErrorKind =
	| 'chat_not_found'
	| 'backend_404'
	| 'generic';

export type StreamLockClearErrorClassification = {
	kind: StreamLockClearErrorKind;
	messageKey:
		| 'streamLockClear404Chat'
		| 'streamLockClear404Backend'
		| 'streamLockClearFailed';
	rawMessage?: string;
};

export function classifyStreamLockClearError(
	err: unknown
): StreamLockClearErrorClassification {
	if (err instanceof APIError && err.statusCode === 404) {
		if (/chat not found/i.test(err.message)) {
			return {
				kind: 'chat_not_found',
				messageKey: 'streamLockClear404Chat',
			};
		}
		return {
			kind: 'backend_404',
			messageKey: 'streamLockClear404Backend',
		};
	}
	const rawMessage =
		err instanceof Error ? err.message.trim() : String(err).trim();
	return {
		kind: 'generic',
		messageKey: 'streamLockClearFailed',
		rawMessage: rawMessage || undefined,
	};
}
