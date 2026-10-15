/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retry authenticated Unified Content `/download` fetches when storage is briefly unavailable
 * (metadata row exists before blob lands — common after music generation completes).
 *
 * Invariants:
 * - Retries only configured HTTP statuses (default 404/502/503); other errors fail fast.
 * - Aborts propagate immediately via `AbortSignal`.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - api/routers/unified_content.py (`download_content`)
 */
import { api } from '@/services/api/client';

export type ContentDownloadParams = {
	disposition?: 'inline' | 'attachment';
	v?: string;
};

export type ContentDownloadRetryOptions = {
	maxAttempts?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	retryStatuses?: readonly number[];
	signal?: AbortSignal;
};

const DEFAULT_RETRY_STATUSES: readonly number[] = [404, 502, 503];

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

function readHttpStatus(err: unknown): number | undefined {
	return (err as { response?: { status?: number } })?.response?.status;
}

/** Fetch content blob with exponential backoff when storage is not ready yet. */
export async function fetchContentDownloadBlobWithRetry(
	contentId: string,
	params: ContentDownloadParams = {},
	options: ContentDownloadRetryOptions = {}
): Promise<Blob> {
	const maxAttempts = options.maxAttempts ?? 8;
	const initialDelayMs = options.initialDelayMs ?? 400;
	const maxDelayMs = options.maxDelayMs ?? 4000;
	const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
	const { signal } = options;

	let lastError: unknown;
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		try {
			const response = await api.get<Blob>(`/content/${contentId}/download`, {
				baseURL: '/api/v1',
				responseType: 'blob',
				params,
				signal,
			});
			if (response instanceof Blob && response.size > 0) {
				const contentType =
					typeof (response as Blob).type === 'string' && response.type.trim()
						? response.type.trim()
						: 'audio/mpeg';
				return response.type === contentType
					? response
					: new Blob([response], { type: contentType });
			}
			throw new Error('EMPTY_CONTENT_BLOB');
		} catch (err: unknown) {
			lastError = err;
			if (signal?.aborted) {
				throw err;
			}
			const status = readHttpStatus(err);
			const canRetry =
				status != null &&
				retryStatuses.includes(status) &&
				attempt < maxAttempts - 1;
			if (!canRetry) {
				throw err;
			}
			const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
			await sleepMs(delay, signal);
		}
	}
	throw lastError ?? new Error('CONTENT_DOWNLOAD_FAILED');
}
