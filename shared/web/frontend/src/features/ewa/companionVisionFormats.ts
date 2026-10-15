/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side mirror of companion vision format allowlist (Gemma 4 E4B / llama.cpp mtmd).
 *
 * Invariants:
 * - Keep in sync with `api/ewa_platform/companion/contracts/vision_formats.py`.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

/** JPEG / PNG / WebP — not GIF, BMP, HEIC, SVG, TIFF. */
export const COMPANION_VISION_ACCEPT = 'image/jpeg,image/png,image/webp';

export const COMPANION_VISION_EXTENSIONS = [
	'.jpg',
	'.jpeg',
	'.png',
	'.webp',
] as const;

export function isCompanionVisionMimeType(mime: string): boolean {
	const m = (mime || '').trim().toLowerCase();
	return m === 'image/jpeg' || m === 'image/png' || m === 'image/webp';
}

export function isCompanionVisionFile(file: File): boolean {
	if (isCompanionVisionMimeType(file.type)) return true;
	const name = file.name.toLowerCase();
	return COMPANION_VISION_EXTENSIONS.some((ext) => name.endsWith(ext));
}
