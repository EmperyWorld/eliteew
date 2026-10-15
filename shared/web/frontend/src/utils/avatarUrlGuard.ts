/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Strict-origin guards for user avatar URLs — block third-party identity leaks (e.g. Gravatar).
 *
 * Invariants:
 * - Trusted: `/api/*`, `unified-content` paths, `blob:`/`data:`, same-origin http(s) only.
 * - External http(s) on foreign origins are rejected at the FE boundary.
 *
 * Related:
 * - src/components/profile/SecureAvatar.tsx
 * - documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md §6 protected media
 */

const DEFAULT_ORIGIN =
	typeof window !== 'undefined'
		? window.location.origin
		: 'https://app.eliteew.ru';

function normalizeTrimmed(url: string): string {
	return url.trim();
}

/** Paths that require authenticated blob fetch (Bearer), not raw `<img src>`. */
export function isAvatarApiDownloadPath(url: string): boolean {
	const trimmed = normalizeTrimmed(url);
	return trimmed.startsWith('/api') || trimmed.includes('unified-content');
}

/**
 * Returns true only for internal/trusted avatar sources.
 * Rejects third-party http(s) (Gravatar, CDN on foreign origin, etc.).
 */
export function isInternalOrTrustedAvatarUrl(
	url: string | null | undefined
): boolean {
	if (url == null || typeof url !== 'string') return false;
	const trimmed = normalizeTrimmed(url);
	if (!trimmed) return false;

	if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
		return true;
	}

	if (isAvatarApiDownloadPath(trimmed)) {
		return true;
	}

	if (trimmed.startsWith('//')) {
		return false;
	}

	try {
		const parsed = new URL(trimmed, DEFAULT_ORIGIN);
		if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') {
			return true;
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return false;
		}
		if (parsed.origin !== DEFAULT_ORIGIN) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

/** Alias for strict-origin avatar guard (Phase 1 Avatar Lockdown). */
export const isInternalOrTrustedUrl = isInternalOrTrustedAvatarUrl;

/**
 * Resolve a trusted URL to an API download path for authenticated blob fetch.
 * Returns null when the URL is untrusted or is a direct same-origin static asset.
 */
export function resolveAvatarApiDownloadPath(
	url: string | null | undefined
): string | null {
	if (!url || !isInternalOrTrustedAvatarUrl(url)) return null;
	const trimmed = normalizeTrimmed(url);
	if (isAvatarApiDownloadPath(trimmed)) {
		return trimmed;
	}
	try {
		const parsed = new URL(trimmed, DEFAULT_ORIGIN);
		if (parsed.origin !== DEFAULT_ORIGIN) return null;
		const path = `${parsed.pathname}${parsed.search}`;
		if (path.startsWith('/api') || path.includes('unified-content')) {
			return path;
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Same-origin static or inline trusted URL safe for direct `<img src>` without Bearer.
 */
export function resolveAvatarDirectSrc(
	url: string | null | undefined
): string | null {
	if (!url || !isInternalOrTrustedAvatarUrl(url)) return null;
	if (resolveAvatarApiDownloadPath(url)) return null;
	return normalizeTrimmed(url);
}
