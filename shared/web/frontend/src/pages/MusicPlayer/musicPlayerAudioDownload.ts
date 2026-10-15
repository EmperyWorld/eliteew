/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Music-scoped Unified Content download helpers with HTTP Range assembly and inline stream URLs.
 *
 * Invariants:
 * - Authenticated byte fetches use `apiFetchWithAuth`; browser streaming uses short-lived ticket URLs.
 * - When the server returns 206, callers assemble the blob from real range slices (no synthetic progress).
 * - Freshly generated files keep 404 retry semantics on the first range probe only.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerAudioRange.ts
 * - src/services/contentApi.ts
 * - src/services/audio/playerAudioContracts.ts
 */

import type { Content } from '@/components/UnifiedContent/types';
import { buildContentDownloadUrlWithDisposition } from '@/services/audio/playerAudioContracts';
import { apiFetchWithAuth } from '@/services/api/client';
import { isFoflineSpaWebAudioHost } from '@/services/audio/foflineDecodedPlayback';
import {
	buildContentBlobCacheRevision,
	contentApi,
} from '@/services/contentApi';

import {
	buildBytesRangeHeader,
	mergeRangeChunks,
	parseContentRangeHeader,
	serverAcceptsByteRanges,
	type ParsedContentRange,
} from './musicPlayerAudioRange';

export const MUSIC_CONTENT_DOWNLOAD_CHUNK_BYTES = 512 * 1024;

const DEFAULT_RETRY_STATUSES: readonly number[] = [404, 502, 503];

export type MusicContentDownloadParams = {
	disposition?: 'inline' | 'attachment';
	version?: string | null;
};

export type MusicContentDownloadRetryOptions = {
	maxAttempts?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	retryStatuses?: readonly number[];
	signal?: AbortSignal;
	chunkBytes?: number;
};

export type ParsedUnifiedContentDownloadPath = {
	contentId: string;
	searchParams: URLSearchParams;
};

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.reject(new DOMException('Aborted', 'AbortError'));
	}
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			window.clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			reject(new DOMException('Aborted', 'AbortError'));
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

function readResponseContentType(response: Response): string {
	const raw = response.headers.get('content-type')?.split(';', 1)[0]?.trim();
	return raw || 'audio/mpeg';
}

function buildMusicContentDownloadUrl(
	contentId: string,
	params: MusicContentDownloadParams = {}
): string {
	return buildContentDownloadUrlWithDisposition(contentId.trim(), {
		disposition: params.disposition ?? 'inline',
		version: params.version ?? null,
	});
}

export function parseUnifiedContentIdFromDownloadPath(
	pathOrUrl: string
): ParsedUnifiedContentDownloadPath | null {
	const trimmed = pathOrUrl.trim();
	if (!trimmed) {
		return null;
	}
	let pathname = trimmed;
	let search = '';
	if (/^https?:\/\//i.test(trimmed)) {
		try {
			const url = new URL(trimmed);
			pathname = url.pathname;
			search = url.search;
		} catch {
			return null;
		}
	} else {
		const queryIndex = trimmed.indexOf('?');
		if (queryIndex >= 0) {
			pathname = trimmed.slice(0, queryIndex);
			search = trimmed.slice(queryIndex);
		}
	}
	const match = pathname.match(
		/^\/api\/v1\/content\/([^/]+)\/download(?:\/|$)/i
	);
	if (!match?.[1]) {
		return null;
	}
	const contentId = decodeURIComponent(match[1]).trim();
	if (!contentId) {
		return null;
	}
	return {
		contentId,
		searchParams: new URLSearchParams(search),
	};
}

export function readMusicContentDownloadParamsFromPath(
	pathOrUrl: string
): MusicContentDownloadParams | null {
	const parsed = parseUnifiedContentIdFromDownloadPath(pathOrUrl);
	if (!parsed) {
		return null;
	}
	const dispositionRaw = parsed.searchParams.get('disposition')?.trim();
	const disposition =
		dispositionRaw === 'attachment' || dispositionRaw === 'inline'
			? dispositionRaw
			: 'inline';
	const version = parsed.searchParams.get('v')?.trim() || null;
	return { disposition, version };
}

async function fetchMusicContentRangeSlice(
	url: string,
	rangeHeader: string,
	signal?: AbortSignal
): Promise<{
	status: number;
	body: ArrayBuffer;
	contentRange: ParsedContentRange | null;
	contentType: string;
	acceptRanges: boolean;
}> {
	const response = await apiFetchWithAuth(url, {
		method: 'GET',
		headers: { Range: rangeHeader },
		signal,
	});
	const body = await response.arrayBuffer();
	return {
		status: response.status,
		body,
		contentRange: parseContentRangeHeader(
			response.headers.get('content-range')
		),
		contentType: readResponseContentType(response),
		acceptRanges: serverAcceptsByteRanges(
			response.headers.get('accept-ranges')
		),
	};
}

async function probeMusicContentDownloadRange(
	url: string,
	options: MusicContentDownloadRetryOptions = {}
): Promise<{
	supportsRange: boolean;
	totalBytes: number | null;
	contentType: string;
	fullBody?: ArrayBuffer;
}> {
	const maxAttempts = options.maxAttempts ?? 8;
	const initialDelayMs = options.initialDelayMs ?? 400;
	const maxDelayMs = options.maxDelayMs ?? 4000;
	const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
	const { signal } = options;

	if (isFoflineSpaWebAudioHost()) {
		const response = await apiFetchWithAuth(url, { signal });
		if (!response.ok) {
			throw new Error(`CONTENT_DOWNLOAD_HTTP_${response.status}`);
		}
		const body = await response.arrayBuffer();
		return {
			supportsRange: false,
			totalBytes: body.byteLength,
			contentType: readResponseContentType(response),
			fullBody: body,
		};
	}

	let lastError: unknown;
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		try {
			const slice = await fetchMusicContentRangeSlice(
				url,
				buildBytesRangeHeader(0, 0),
				signal
			);
			if (retryStatuses.includes(slice.status) && attempt < maxAttempts - 1) {
				const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
				await sleepMs(delay, signal);
				continue;
			}
			if (slice.status === 206 && slice.contentRange) {
				return {
					supportsRange: true,
					totalBytes: slice.contentRange.total,
					contentType: slice.contentType,
				};
			}
			if (slice.status === 200) {
				return {
					supportsRange: slice.acceptRanges,
					totalBytes: slice.body.byteLength,
					contentType: slice.contentType,
					fullBody: slice.body,
				};
			}
			if (slice.status === 416) {
				throw new Error('CONTENT_RANGE_NOT_SATISFIABLE');
			}
			throw new Error(`CONTENT_DOWNLOAD_HTTP_${slice.status}`);
		} catch (err: unknown) {
			lastError = err;
			if (signal?.aborted) {
				throw err;
			}
			if (attempt >= maxAttempts - 1) {
				throw err;
			}
			const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
			await sleepMs(delay, signal);
		}
	}
	throw lastError ?? new Error('CONTENT_DOWNLOAD_PROBE_FAILED');
}

async function assembleMusicContentBlobFromRanges(
	url: string,
	totalBytes: number,
	contentType: string,
	options: MusicContentDownloadRetryOptions = {}
): Promise<Blob> {
	const chunkBytes = options.chunkBytes ?? MUSIC_CONTENT_DOWNLOAD_CHUNK_BYTES;
	const { signal } = options;
	const chunks: Uint8Array[] = [];
	let offset = 0;

	while (offset < totalBytes) {
		const end = Math.min(offset + chunkBytes - 1, totalBytes - 1);
		const slice = await fetchMusicContentRangeSlice(
			url,
			buildBytesRangeHeader(offset, end),
			signal
		);
		if (slice.status !== 206 || !slice.contentRange) {
			throw new Error('CONTENT_RANGE_SLICE_FAILED');
		}
		chunks.push(new Uint8Array(slice.body));
		offset = slice.contentRange.end + 1;
	}

	return new Blob([mergeRangeChunks(chunks)], { type: contentType });
}

export async function resolveMusicContentInlineStreamUrl(
	contentId: string,
	options?: {
		version?: string | null;
		signal?: AbortSignal;
	}
): Promise<string> {
	const trimmedId = contentId.trim();
	if (!trimmedId) {
		throw new Error('EMPTY_CONTENT_ID');
	}
	if (options?.signal?.aborted) {
		throw new DOMException('Aborted', 'AbortError');
	}
	const ticket = await contentApi.createContentDownloadTicket(trimmedId, {
		disposition: 'inline',
		revision: options?.version ?? null,
	});
	const directUrl = ticket.download_url.trim();
	if (!directUrl) {
		throw new Error('CONTENT_DOWNLOAD_TICKET_URL_EMPTY');
	}
	return directUrl.startsWith('http')
		? directUrl
		: new URL(directUrl, window.location.origin).href;
}

export async function fetchMusicContentDownloadBlobWithRanges(
	contentId: string,
	params: MusicContentDownloadParams = {},
	options: MusicContentDownloadRetryOptions = {}
): Promise<Blob> {
	const trimmedId = contentId.trim();
	if (!trimmedId) {
		throw new Error('EMPTY_CONTENT_ID');
	}
	const url = buildMusicContentDownloadUrl(trimmedId, params);
	const probe = await probeMusicContentDownloadRange(url, options);

	if (probe.fullBody) {
		if (probe.fullBody.byteLength <= 0) {
			throw new Error('EMPTY_CONTENT_BLOB');
		}
		return new Blob([probe.fullBody], { type: probe.contentType });
	}

	if (
		!probe.supportsRange ||
		probe.totalBytes == null ||
		probe.totalBytes <= 0
	) {
		const response = await apiFetchWithAuth(url, {
			method: 'GET',
			signal: options.signal,
		});
		if (!response.ok) {
			throw new Error(`CONTENT_DOWNLOAD_HTTP_${response.status}`);
		}
		const body = await response.arrayBuffer();
		if (body.byteLength <= 0) {
			throw new Error('EMPTY_CONTENT_BLOB');
		}
		return new Blob([body], { type: readResponseContentType(response) });
	}

	return assembleMusicContentBlobFromRanges(
		url,
		probe.totalBytes,
		probe.contentType,
		options
	);
}

export async function fetchMusicDownloadPathBlobWithRanges(
	downloadPath: string,
	options: MusicContentDownloadRetryOptions = {}
): Promise<Blob> {
	const parsed = parseUnifiedContentIdFromDownloadPath(downloadPath);
	if (!parsed) {
		throw new Error('UNSUPPORTED_MUSIC_DOWNLOAD_PATH');
	}
	const params = readMusicContentDownloadParamsFromPath(downloadPath) ?? {
		disposition: 'inline' as const,
		version: null,
	};
	return fetchMusicContentDownloadBlobWithRanges(
		parsed.contentId,
		params,
		options
	);
}

export async function downloadMusicPlayerTrackToBrowser(
	track: Pick<Content, 'id' | 'name' | 'updated_at' | 'file_size'>
): Promise<void> {
	await contentApi.downloadContentToBrowser({
		contentId: track.id,
		preferredFilename: track.name,
		revision: buildContentBlobCacheRevision(track),
		disposition: 'attachment',
	});
}

export async function resolveMusicPlayerTrackInlineStreamUrl(
	track: Pick<Content, 'id' | 'updated_at' | 'file_size'> & {
		version?: string | null;
	},
	options?: { signal?: AbortSignal }
): Promise<string> {
	const explicitVersion = track.version?.trim();
	const version =
		explicitVersion && explicitVersion.length > 0
			? explicitVersion
			: buildContentBlobCacheRevision(track);
	return resolveMusicContentInlineStreamUrl(track.id, {
		version,
		signal: options?.signal,
	});
}
