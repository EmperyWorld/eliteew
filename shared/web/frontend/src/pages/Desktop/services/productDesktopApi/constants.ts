/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared product-desktop API path constants and EWDesk media blob URL helpers.
 *
 * Invariants:
 * - Base mount is **`/api/v1/product-desktop`** (`PRODUCT_DESKTOP_API_V1_BASE`).
 *
 * Related:
 * - `shared/api/routers/product_desktop.py`
 * - `services/productDesktopApi.ts`
 */

/** Product desktop / EWDesk API (`shared/api/routers/product_desktop.py` + `domains/desktop.py`). */
export const PRODUCT_DESKTOP_API_V1_BASE = '/api/v1/product-desktop' as const;

/** Internal alias for child modules — same segment as `PRODUCT_DESKTOP_API_V1_BASE`. */
export const PRODUCT_DESKTOP_API_BASE = PRODUCT_DESKTOP_API_V1_BASE;

/** GET blob for EWDesk hero when `image_content_id` is set (published posts only). */
export function ewDeskNewsLinkedImagePath(contentId: string): string {
	return `${PRODUCT_DESKTOP_API_BASE}/news-linked-image/${contentId}`;
}

/** GET blob for EWDesk hero when `video_content_id` is set (published posts only). */
export function ewDeskNewsLinkedVideoPath(contentId: string): string {
	return `${PRODUCT_DESKTOP_API_BASE}/news-linked-video/${contentId}`;
}

/** GET blob for optional audio attachment (published posts only). */
export function ewDeskNewsLinkedAudioPath(contentId: string): string {
	return `${PRODUCT_DESKTOP_API_BASE}/news-linked-audio/${contentId}`;
}
