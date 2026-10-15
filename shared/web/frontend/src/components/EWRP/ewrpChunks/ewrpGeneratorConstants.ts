/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP generator shared constants, Content Manager helpers, and presentation theme/layout catalogs.
 *
 * Invariants:
 * - Credits and slide bounds stay aligned with API generation_types / create-flow caps.
 * - CM text source filter excludes image/video/audio and image-like filenames.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { contentApi } from '@/services/contentApi';

/** Current per-slide rate (5→1000 … 20→4000 ⚡); matches `generation_types.cost_credits` after migration. */
export const EWRP_CREDITS_PER_SLIDE = 200;
/** Legacy scale for struck-through price in the UI (20 slides → 10000 ⚡). */
export const EWRP_LEGACY_CREDITS_PER_SLIDE = 500;

export type ContentItem = {
	id: string;
	name: string;
	content_type: string;
	created_at: string;
};

/** Content Manager types with extractable text in EWRP (not images/video/audio). */
export const EWRP_CM_TEXT_TYPES = [
	'document',
	'presentation',
	'spreadsheet',
] as const;

/** When a file is mis-tagged as document but the name looks like an image. */
export const IMAGE_FILE_NAME_RE =
	/\.(png|jpe?g|gif|webp|bmp|svg|ico|heic|avif|tiff?)$/i;

export function contentTypeBadgeShort(contentType: string): string {
	const ct = (contentType || '').toLowerCase();
	switch (ct) {
		case 'document':
			return 'DOC';
		case 'presentation':
			return 'PPT';
		case 'spreadsheet':
			return 'XLS';
		case 'image':
			return 'IMG';
		case 'video':
			return 'VID';
		case 'audio':
			return 'AUD';
		case 'ai_result':
			return 'AI';
		case 'other':
			return '…';
		default:
			return ct ? ct.slice(0, 3).toUpperCase() : '?';
	}
}

export function isEwrpCmTextSource(item: ContentItem): boolean {
	const ct = (item.content_type || '').toLowerCase();
	if (ct === 'image' || ct === 'video' || ct === 'audio') return false;
	if (IMAGE_FILE_NAME_RE.test(item.name.trim())) return false;
	return true;
}

export async function loadEwrpContentManagerItems(): Promise<ContentItem[]> {
	const results = await Promise.all(
		EWRP_CM_TEXT_TYPES.map((content_type) =>
			contentApi.listContent({
				limit: 80,
				offset: 0,
				content_type,
				sort_field: 'date',
				sort_order: 'desc',
				list_profile: 'compact',
			})
		)
	);
	const byId = new Map<string, ContentItem>();
	for (const { items } of results) {
		for (const row of items) {
			const item: ContentItem = {
				id: row.id,
				name: row.name,
				content_type: row.content_type,
				created_at: row.created_at,
			};
			if (!isEwrpCmTextSource(item)) continue;
			if (!byId.has(item.id)) byId.set(item.id, item);
		}
	}
	return [...byId.values()].sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

/** Rare GET /ewrp/{id}/status: one in-flight request max; long interval (generation is minutes). */
export const POLL_INTERVAL_MS = 10_000;
export const FIRST_POLL_DELAY_MS = 1200;
export const EWRP_RESTORE_KEY = 'ewrp-active-job-id';
/** Editor: same bounds as create flow (3–20); upper cap only on the start form. */
export const EWRP_MAX_SLIDES_EDITOR = 20;
export const EWRP_MIN_SLIDES_EDITOR = 1;
/** Editor slide list: virtualize above this count (DnD disabled — use move buttons). */
export const EWRP_EDITOR_SLIDES_VIRTUAL_THRESHOLD = 15;
/** PDF look (`presentation_theme` in API): background and palette, not bullet layout. */
export const EWRP_PRESENTATION_THEME_IDS = [
	'classic',
	'midnight',
	'ember',
	'aurora',
	'paper',
	'editorial',
	'brutal',
	'noir',
	'linen',
] as const;
export type EwrpPresentationThemeId =
	(typeof EWRP_PRESENTATION_THEME_IDS)[number];

/** First-slide cover mode (`first_slide_style` in API). */
export const EWRP_FIRST_SLIDE_STYLE_IDS = ['standard', 'title_only'] as const;
export type EwrpFirstSlideStyleId = (typeof EWRP_FIRST_SLIDE_STYLE_IDS)[number];

/** Matches `layout` in API / `ewrp_templates.py`; empty string means auto. */
export const EWRP_SLIDE_LAYOUT_VALUES = [
	'',
	'default',
	'section',
	'steps',
	'closing',
	'quote',
	'statement',
	'split',
	'grid',
	'kpi',
	'fullbleed',
	'title_only',
] as const;

/** Maps layout value to `ewrp.slideLayouts.*` key (empty → `auto`). */
export function ewrpSlideLayoutI18nKey(value: string): string {
	return value === '' ? 'auto' : value;
}
export const EWRP_EXTRA_CONTEXT_MAX = 8000;
/** Long lists use virtualization — less DOM with 50+ jobs / hundreds of CM files. */
export const EWRP_VIRTUAL_LIST_THRESHOLD = 12;
export const EWRP_HISTORY_VIRTUAL_HEIGHT_PX = 320;
export const EWRP_DOC_PICKER_VIRTUAL_HEIGHT_PX = 420;
export const EWRP_HISTORY_PAGE_SIZE = 50;
