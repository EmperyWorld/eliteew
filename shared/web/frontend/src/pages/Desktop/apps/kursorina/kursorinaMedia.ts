/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect library image artifacts in Kursorina mission results and map to
 * authenticated content download API paths.
 *
 * Invariants:
 * - Only UUID content refs become download paths (no arbitrary URLs).
 * - Image detection is conservative (extension / binary extract markers).
 *
 * Related:
 * - shared/api/services/kursorina/library.py (save_binary → kind=library, ref=content_id)
 * - shared/web/frontend/src/features/desktop-ai-chat/DesktopAiChatMarkdown.media.tsx
 */

import type { MissionResultItem } from './types';

const CONTENT_UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)\b/i;

/** Content Manager download path when `ref` is a content UUID. */
export function contentDownloadApiPath(ref: string): string | null {
	const id = (ref || '').trim();
	if (!CONTENT_UUID_RE.test(id)) return null;
	return `/api/v1/content/${id}/download`;
}

/**
 * Library / library_hit rows that look like PNG (or other image) artifacts
 * saved by Kursorina (`save_png` / `tool_save_binary_to_library`).
 */
export function isLibraryImageResult(item: MissionResultItem): boolean {
	if (item.kind !== 'library' && item.kind !== 'library_hit') return false;
	if (!contentDownloadApiPath(item.ref)) return false;
	const blob = `${item.title}\n${item.snippet}`.toLowerCase();
	if (IMAGE_EXT_RE.test(blob)) return true;
	// Binary save extract: "name.png bytes=1234 content_id=…"
	if (
		blob.includes('bytes=') &&
		(blob.includes('.png') || blob.includes('png'))
	) {
		return true;
	}
	return false;
}

/** Stable display title for a chart/image finding. */
export function libraryImageTitle(item: MissionResultItem): string {
	const raw = (item.title || item.snippet || 'График').trim();
	const first = raw.split(/\s+/)[0] || 'График';
	if (IMAGE_EXT_RE.test(first)) return first;
	const m = raw.match(/([^\s/\\]+\.(?:png|jpe?g|webp|gif))/i);
	return m?.[1] ?? (item.title || 'График').slice(0, 80);
}

export function listLibraryImageResults(
	results: MissionResultItem[] | undefined | null
): MissionResultItem[] {
	if (!results?.length) return [];
	const seen = new Set<string>();
	const out: MissionResultItem[] = [];
	for (const item of results) {
		if (!isLibraryImageResult(item)) continue;
		const key = item.ref.trim().toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	return out;
}
