/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure HTTP Range helpers for music playback/download against Unified Content `/download`.
 *
 * Invariants:
 * - Only `bytes` unit ranges are supported (matches backend `unified_content.py`).
 * - Invalid or missing `Content-Range` headers yield null instead of throwing.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerAudioDownload.ts
 * - shared/api/routers/unified_content.py (`_build_content_download_response`)
 */

export type ParsedContentRange = {
	unit: 'bytes';
	start: number;
	end: number;
	total: number;
};

const CONTENT_RANGE_RE = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i;

export function parseContentRangeHeader(
	header: string | null | undefined
): ParsedContentRange | null {
	const trimmed = header?.trim();
	if (!trimmed) {
		return null;
	}
	const match = CONTENT_RANGE_RE.exec(trimmed);
	if (!match) {
		return null;
	}
	const start = Number.parseInt(match[1] ?? '', 10);
	const end = Number.parseInt(match[2] ?? '', 10);
	const totalRaw = match[3];
	const total =
		totalRaw === '*' ? Number.NaN : Number.parseInt(totalRaw ?? '', 10);
	if (
		!Number.isFinite(start) ||
		!Number.isFinite(end) ||
		start < 0 ||
		end < start
	) {
		return null;
	}
	if (totalRaw !== '*' && (!Number.isFinite(total) || total <= end)) {
		return null;
	}
	return {
		unit: 'bytes',
		start,
		end,
		total: totalRaw === '*' ? end + 1 : total,
	};
}

export function serverAcceptsByteRanges(
	acceptRangesHeader: string | null | undefined
): boolean {
	return acceptRangesHeader?.trim().toLowerCase() === 'bytes';
}

export function buildBytesRangeHeader(start: number, end?: number): string {
	if (!Number.isFinite(start) || start < 0) {
		throw new Error('INVALID_RANGE_START');
	}
	if (end == null) {
		return `bytes=${Math.floor(start)}-`;
	}
	if (!Number.isFinite(end) || end < start) {
		throw new Error('INVALID_RANGE_END');
	}
	return `bytes=${Math.floor(start)}-${Math.floor(end)}`;
}

export function buildSuffixBytesRangeHeader(suffixLength: number): string {
	if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
		throw new Error('INVALID_RANGE_SUFFIX');
	}
	return `bytes=-${Math.floor(suffixLength)}`;
}

export function mergeRangeChunks(chunks: readonly Uint8Array[]): Blob {
	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const merged = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new Blob([merged]);
}
