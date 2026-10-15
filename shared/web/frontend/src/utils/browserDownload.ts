/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central browser download helpers for direct URL navigation and Blob fallback.
 *
 * Invariants:
 * - Direct URLs must already carry their own safe authorization model; never
 *   append bearer tokens here.
 * - Blob object URLs are revoked after the browser has had time to start the
 *   transfer, not synchronously on click.
 *
 * Related:
 * - services/contentApi.ts
 * - services/ewrpApi.ts
 * ---
 */

export type BrowserDownloadUrlOptions = {
	download?: string;
	target?: '_self' | '_blank';
	rel?: string;
};

export type BrowserDownloadBlobOptions = BrowserDownloadUrlOptions & {
	revokeDelayMs?: number;
};

const DEFAULT_BLOB_REVOKE_DELAY_MS = 60_000;

export function triggerBrowserDownloadFromUrl(
	href: string,
	options: BrowserDownloadUrlOptions = {}
): void {
	if (typeof document === 'undefined') {
		return;
	}
	const trimmedHref = href.trim();
	if (!trimmedHref) {
		return;
	}
	const anchor = document.createElement('a');
	anchor.href = trimmedHref;
	if (options.download?.trim()) {
		anchor.download = options.download.trim();
	}
	if (options.target) {
		anchor.target = options.target;
	}
	anchor.rel = options.rel ?? 'noopener noreferrer';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

export function triggerBrowserDownloadFromBlob(
	blob: Blob,
	filename: string,
	options: BrowserDownloadBlobOptions = {}
): string | null {
	const url = createRevocableObjectUrlFromBlob(blob, options.revokeDelayMs);
	if (!url) return null;
	triggerBrowserDownloadFromUrl(url, {
		download: filename,
		target: options.target,
		rel: options.rel,
	});
	return url;
}

export function createRevocableObjectUrlFromBlob(
	blob: Blob,
	revokeDelayMs = DEFAULT_BLOB_REVOKE_DELAY_MS
): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const url = window.URL.createObjectURL(blob);
	window.setTimeout(() => window.URL.revokeObjectURL(url), revokeDelayMs);
	return url;
}
