/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified user-visible error reporting and direct-vs-blob fallback orchestration
 * for Unified Content browser downloads.
 *
 * Invariants:
 * - Terminal download failures always surface via `notify.error`, never console-only.
 * - Direct ticket URLs are probed before navigation; probe failure falls back to blob path.
 * - Abort/cancel errors never show error toasts.
 *
 * Related:
 * - src/services/contentApi.ts
 * - src/utils/browserDownload.ts
 * - src/services/api/error-handler.ts
 */
import axios from 'axios';
import { notify } from '@/notifications';
import { isFoflineSpaWebAudioHost } from '@/services/audio/foflineDecodedPlayback';
import { APIError } from '../api/client';
import { ErrorMessages } from '../api/config';
import { normalizeApiError } from '../api/error-handler';
import { shouldDedupeErrorToast } from '../maintenance/recoveryNotificationGuard';
import {
	triggerBrowserDownloadFromBlob,
	triggerBrowserDownloadFromUrl,
} from '../../utils/browserDownload';
import { log } from '../../utils/logger';
import { logUxError } from '../../utils/uxErrorLog';

export const CONTENT_DOWNLOAD_ERROR_TITLE = 'Download failed' as const;

const CONTENT_DOWNLOAD_TOAST_DURATION_MS = 5000;

export type ContentDownloadContext = {
	operation: string;
	contentId?: string;
	versionId?: string;
	archiveName?: string | null;
};

function isAbortLike(error: unknown): boolean {
	if (axios.isCancel(error)) {
		return true;
	}
	if (!axios.isAxiosError(error)) {
		return false;
	}
	return (
		error.code === 'ERR_CANCELED' ||
		error.name === 'CanceledError' ||
		error.message === 'canceled'
	);
}

function isNetworkLike(error: unknown): boolean {
	if (axios.isAxiosError(error) && !error.response) {
		if (error.request) {
			return true;
		}
		const msg = error.message || '';
		if (/network|ECONNREFUSED|ENOTFOUND|ERR_NETWORK/i.test(msg)) {
			return true;
		}
	}
	if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
		return true;
	}
	if (error instanceof APIError && error.isNetworkError) {
		return true;
	}
	return false;
}

function resolveStatusCode(error: unknown): number | undefined {
	if (error instanceof APIError && error.statusCode) {
		return error.statusCode;
	}
	if (axios.isAxiosError(error) && error.response?.status) {
		return error.response.status;
	}
	return undefined;
}

export function classifyContentDownloadFailure(error: unknown): {
	title: string;
	message: string;
} {
	if (isAbortLike(error)) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: ErrorMessages.canceled,
		};
	}

	if (isNetworkLike(error)) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: 'Download Failed',
		};
	}

	const statusCode = resolveStatusCode(error);
	if (statusCode === 403) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: 'Access Denied',
		};
	}
	if (statusCode === 401) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: ErrorMessages.unauthorized,
		};
	}
	if (statusCode === 404) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: ErrorMessages.notFound,
		};
	}
	if (statusCode === 408) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: ErrorMessages.timeout,
		};
	}
	if (statusCode && statusCode >= 500) {
		return {
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: ErrorMessages.serverError,
		};
	}

	const normalized = normalizeApiError(error);
	const reason =
		typeof normalized === 'string'
			? normalized
			: normalized.message || ErrorMessages.unknown;

	return {
		title: CONTENT_DOWNLOAD_ERROR_TITLE,
		message: reason.trim() || 'Download Failed',
	};
}

export function reportContentDownloadFailure(
	error: unknown,
	context: ContentDownloadContext
): void {
	if (isAbortLike(error)) {
		return;
	}

	const { title, message } = classifyContentDownloadFailure(error);
	if (shouldDedupeErrorToast(title, message)) {
		return;
	}

	logUxError('unified_content', context.operation, error, {
		contentId: context.contentId,
		versionId: context.versionId,
		archiveName: context.archiveName,
	});

	notify.error(title, message, {
		duration: CONTENT_DOWNLOAD_TOAST_DURATION_MS,
	});
}

export async function probeDirectDownloadUrl(url: string): Promise<void> {
	// EmpiierOS: a 206 slice is not a playable track and must not be a media src.
	if (isFoflineSpaWebAudioHost()) {
		return;
	}
	if (typeof fetch === 'undefined') {
		return;
	}
	const trimmed = url.trim();
	if (!trimmed) {
		throw new APIError('Direct download URL is empty', 400);
	}

	const response = await fetch(trimmed, {
		method: 'GET',
		credentials: 'include',
		headers: { Range: 'bytes=0-0' },
	});

	if (response.ok || response.status === 206) {
		return;
	}

	throw new APIError(
		`Direct download unreachable (${response.status})`,
		response.status,
		undefined,
		undefined,
		undefined,
		trimmed
	);
}

function resolveDownloadFilename(
	preferred: string | undefined,
	headerFilename: string | undefined,
	defaultName: string
): string {
	const preferredTrimmed = preferred?.trim();
	if (preferredTrimmed) {
		return preferredTrimmed;
	}
	const headerTrimmed = headerFilename?.trim();
	if (headerTrimmed) {
		return headerTrimmed;
	}
	return defaultName;
}

export type RunBrowserContentDownloadOptions = {
	operation: string;
	contentId?: string;
	versionId?: string;
	archiveName?: string | null;
	preferredFilename?: string;
	fallbackDefaultFilename: string;
	resolveDirectUrl: () => Promise<string | null>;
	runBlobDownload: () => Promise<{ blob: Blob; filename?: string }>;
};

export async function runBrowserContentDownload(
	options: RunBrowserContentDownloadOptions
): Promise<void> {
	const preferredFilename = options.preferredFilename?.trim() || undefined;

	try {
		const directUrl = await options.resolveDirectUrl();
		if (directUrl?.trim()) {
			await probeDirectDownloadUrl(directUrl);
			triggerBrowserDownloadFromUrl(directUrl, {
				download: preferredFilename,
			});
			return;
		}
	} catch (directError) {
		if (isAbortLike(directError)) {
			throw directError;
		}
		log.debug(
			'ContentDownload',
			'[content download] direct path failed; trying blob fallback',
			{
				operation: options.operation,
				contentId: options.contentId,
				versionId: options.versionId,
				error:
					directError instanceof Error
						? directError.message
						: String(directError),
			}
		);
	}

	try {
		const { blob, filename } = await options.runBlobDownload();
		triggerBrowserDownloadFromBlob(
			blob,
			resolveDownloadFilename(
				preferredFilename,
				filename,
				options.fallbackDefaultFilename
			)
		);
	} catch (blobError) {
		if (isAbortLike(blobError)) {
			throw blobError;
		}
		reportContentDownloadFailure(blobError, {
			operation: options.operation,
			contentId: options.contentId,
			versionId: options.versionId,
			archiveName: options.archiveName,
		});
		throw blobError;
	}
}
