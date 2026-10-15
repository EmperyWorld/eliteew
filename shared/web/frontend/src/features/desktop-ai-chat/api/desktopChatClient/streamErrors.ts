/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Classify Desktop AI Chat stream failures for retry / busy / solo-slot UX.
 *
 * Invariants:
 * - DesktopAiSseTerminalError → non-retryable sse kind.
 * - 409 turn_in_progress sets turnBusy + canClearStreamLock.
 * - 409 discussion_active maps to user copy (not the raw API detail). Dual-flag:
 *   Council internal mode=discussion is not this product Discussion.
 * - Stream error bubble uses classified message only — never the transport string.
 *
 * Related:
 * - ./stream.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import { tDesktopAiApiError } from './shared';
import {
	DesktopAiSseTerminalError,
	type DesktopStreamErrorClassification,
} from './types';

export function classifyDesktopStreamError(
	e: unknown
): DesktopStreamErrorClassification {
	if (e instanceof DesktopAiSseTerminalError) {
		const m = e.message.replace(/^SSE:\s*/i, '').trim() || e.message;
		return {
			kind: 'sse',
			message: m,
			retryable: false,
		};
	}
	if (
		typeof DOMException !== 'undefined' &&
		e instanceof DOMException &&
		e.name === 'AbortError'
	) {
		return {
			kind: 'abort',
			message: e.message || tDesktopAiApiError('abortedDefault'),
			retryable: false,
		};
	}
	if (e instanceof Error && e.name === 'AbortError') {
		return {
			kind: 'abort',
			message: e.message || tDesktopAiApiError('abortedDefault'),
			retryable: false,
		};
	}
	const msg = e instanceof Error ? e.message : String(e);
	const lower = msg.toLowerCase();
	if (
		typeof TypeError !== 'undefined' &&
		e instanceof TypeError &&
		(lower.includes('fetch') ||
			lower.includes('network') ||
			lower.includes('failed'))
	) {
		return {
			kind: 'network',
			message: tDesktopAiApiError('networkConnectFailed'),
			retryable: true,
		};
	}
	if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
		return {
			kind: 'network',
			message: tDesktopAiApiError('networkDisconnected'),
			retryable: true,
		};
	}
	if (msg.includes('401') || lower.includes('unauthorized')) {
		return {
			kind: 'auth',
			message: tDesktopAiApiError('sessionExpired'),
			retryable: false,
		};
	}
	if (/stream failed\s*401/i.test(msg) || /^401\b/.test(msg)) {
		return {
			kind: 'auth',
			message: tDesktopAiApiError('stream401'),
			retryable: false,
		};
	}
	const httpFail = /stream failed\s*(\d{3})/i.exec(msg);
	if (httpFail) {
		const code = httpFail[1];
		if (code === '403' && /solo_slot_(required|expired)/i.test(msg)) {
			return {
				kind: 'http',
				message: msg.length < 320 ? msg : tDesktopAiApiError('soloSlot403'),
				retryable: false,
				soloSlotBlocked: true,
			};
		}
		if (code === '409') {
			const turn = /turn_in_progress/i.test(msg);
			const discussionActive = /discussion_active/i.test(msg);
			return {
				kind: 'http',
				message: turn
					? tDesktopAiApiError('conflictTurnInProgress')
					: discussionActive
						? tDesktopAiApiError('conflictDiscussionActive')
						: msg.length < 320
							? msg
							: tDesktopAiApiError('conflictDuplicate'),
				retryable: false,
				turnBusy: turn,
				// Owner may still clear a stuck lock; guests get soft busy UX only.
				canClearStreamLock: turn,
			};
		}
		return {
			kind: 'http',
			message:
				msg.length < 320
					? msg
					: tDesktopAiApiError('streamHttpGeneric', { code }),
			retryable: code === '502' || code === '503' || code === '504',
		};
	}
	if (lower.startsWith('sse:') || msg.includes('SSE:')) {
		return {
			kind: 'sse',
			message: msg.replace(/^SSE:\s*/i, '').trim() || msg,
			retryable: false,
		};
	}
	return {
		kind: 'unknown',
		message: msg || tDesktopAiApiError('unknownError'),
		retryable: false,
	};
}

/** Assistant-bubble copy: classified user message only — never `Stream failed …: detail`. */
export function formatDesktopStreamErrorBubble(
	classifiedMessage: string,
	t: (key: string, opts: { message: string }) => string
): string {
	return t('streamErrorInBubble', { message: classifiedMessage });
}
