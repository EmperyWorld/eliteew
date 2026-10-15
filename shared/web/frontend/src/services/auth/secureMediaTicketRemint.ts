/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Secure inline media ticket re-mint after expired ticket URLs — backend ACL is source of truth;
 * frontend blocks remint when session is invalid or contentId does not match active playback.
 *
 * Invariants:
 * - Never remint for a contentId different from allowedContentId (no privilege pivot on 401).
 * - 403/401 from download-ticket POST is terminal — no second remint attempt.
 * - Caller must treat backend denial as access denied, not a signal to retry with another id.
 *
 * Related:
 * - services/contentApi.ts (createContentDownloadTicket)
 * - pages/Desktop/context/NowPlayingContext.tsx
 */

import { APIError } from '../api/client';
import { contentApi } from '../contentApi';
import {
	parseUnifiedContentIdFromDownloadPath,
	readMusicContentDownloadParamsFromPath,
} from '../../pages/MusicPlayer/musicPlayerAudioDownload';
import authSession from '../authSession';
import { isAuthSessionLocked } from './authSessionLock';

export type SecureMediaTicketRemintReason =
	| 'access_denied'
	| 'auth_lost'
	| 'identity_mismatch'
	| 'not_ticket_url'
	| 'remint_failed';

export type SecureMediaTicketRemintResult =
	| { ok: true; streamUrl: string }
	| {
			ok: false;
			terminal: true;
			reason: SecureMediaTicketRemintReason;
			statusCode?: number;
	  };

export type SecureMediaTicketRemintContext = {
	contentId: string;
	allowedContentId: string;
	version?: string | null;
};

const TICKET_PATH_SEGMENT = '/download-by-ticket';

export function isContentTicketStreamUrl(url: string): boolean {
	const trimmed = url.trim();
	if (!trimmed) {
		return false;
	}
	try {
		const pathname = trimmed.startsWith('http')
			? new URL(trimmed).pathname
			: (trimmed.split('?')[0] ?? trimmed);
		return pathname.includes(TICKET_PATH_SEGMENT);
	} catch {
		return trimmed.includes(TICKET_PATH_SEGMENT);
	}
}

export function canAttemptSecureMediaTicketRemint(
	ctx: SecureMediaTicketRemintContext
): boolean {
	if (isAuthSessionLocked()) {
		return false;
	}
	if (!authSession.authenticated || !authSession.token?.trim()) {
		return false;
	}
	const contentId = ctx.contentId.trim();
	const allowed = ctx.allowedContentId.trim();
	if (!contentId || !allowed) {
		return false;
	}
	return contentId === allowed;
}

function readHttpStatus(error: unknown): number | undefined {
	if (error instanceof APIError && error.statusCode != null) {
		return error.statusCode;
	}
	const status = (error as { response?: { status?: number } })?.response
		?.status;
	return typeof status === 'number' ? status : undefined;
}

function normalizeStreamUrl(downloadUrl: string): string {
	const directUrl = downloadUrl.trim();
	if (!directUrl) {
		throw new Error('CONTENT_DOWNLOAD_TICKET_URL_EMPTY');
	}
	return directUrl.startsWith('http')
		? directUrl
		: new URL(directUrl, window.location.origin).href;
}

/** Backend-driven ticket re-mint for inline media; fails closed on auth/ACL errors. */
export async function secureRemintContentInlineStreamUrl(
	ctx: SecureMediaTicketRemintContext,
	options?: { signal?: AbortSignal }
): Promise<SecureMediaTicketRemintResult> {
	if (!canAttemptSecureMediaTicketRemint(ctx)) {
		return { ok: false, terminal: true, reason: 'identity_mismatch' };
	}

	try {
		const ticket = await contentApi.createContentDownloadTicket(ctx.contentId, {
			disposition: 'inline',
			revision: ctx.version ?? null,
		});
		if (options?.signal?.aborted) {
			return { ok: false, terminal: true, reason: 'remint_failed' };
		}
		return { ok: true, streamUrl: normalizeStreamUrl(ticket.download_url) };
	} catch (error: unknown) {
		const statusCode = readHttpStatus(error);
		if (statusCode === 403) {
			return {
				ok: false,
				terminal: true,
				reason: 'access_denied',
				statusCode: 403,
			};
		}
		if (statusCode === 401) {
			return {
				ok: false,
				terminal: true,
				reason: 'auth_lost',
				statusCode: 401,
			};
		}
		return {
			ok: false,
			terminal: true,
			reason: 'remint_failed',
			statusCode,
		};
	}
}

/** Resolve remint context from an expired ticket stream URL and active content id. */
export function buildSecureMediaTicketRemintContext(
	streamUrl: string,
	allowedContentId: string
): SecureMediaTicketRemintContext | null {
	if (!isContentTicketStreamUrl(streamUrl)) {
		return null;
	}
	const parsed = parseUnifiedContentIdFromDownloadPath(streamUrl);
	const ticketMatch = streamUrl.match(
		/\/api\/v1\/content\/([^/?#]+)\/download-by-ticket/i
	);
	const contentId = (
		parsed?.contentId ??
		(ticketMatch?.[1] ? decodeURIComponent(ticketMatch[1]) : '')
	).trim();
	if (!contentId) {
		return null;
	}
	const params = readMusicContentDownloadParamsFromPath(streamUrl);
	let version = params?.version ?? null;
	if (!version) {
		try {
			const query = streamUrl.includes('?')
				? streamUrl.slice(streamUrl.indexOf('?'))
				: '';
			version = new URLSearchParams(query).get('v')?.trim() || null;
		} catch {
			version = null;
		}
	}
	return {
		contentId,
		allowedContentId,
		version,
	};
}
