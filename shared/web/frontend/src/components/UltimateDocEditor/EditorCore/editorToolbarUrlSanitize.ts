/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * URL and image src normalization for Ultimate Doc Editor toolbar insert popovers,
 * plus table dimension clamping.
 *
 * Invariants:
 * - sanitizeImageSrc must not delegate to sanitizeUrl — data:/blob: URLs lack :// and would break.
 *
 * Related:
 * - EditorToolbar.tsx, shortenDataUrlForImageInsert.ts
 */
import { shortenDataUrlForImageInsert } from '../utils/shortenDataUrlForImageInsert';

export function sanitizeUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return '';
	}
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

/** Do not mix with `sanitizeUrl` for links: `data:` / `blob:` have no `://`, else `https://data:...` → ERR_INVALID_URL */
export function sanitizeImageSrc(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return '';
	}
	if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
		return shortenDataUrlForImageInsert(trimmed);
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
		return typeof window !== 'undefined'
			? `${window.location.origin}${trimmed}`
			: trimmed;
	}
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

export function clampSize(value: number): number {
	if (Number.isNaN(value)) {
		return 1;
	}
	return Math.min(Math.max(value, 1), 12);
}
