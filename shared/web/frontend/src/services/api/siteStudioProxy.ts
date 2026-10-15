import { SITE_STUDIO_PROXY_BASE_PATH } from './config';

const SITE_STUDIO_PROXY_BASE = SITE_STUDIO_PROXY_BASE_PATH;

const DEFAULT_ADMIN_SESSION_PATH =
	'/api/v1/desktop/site-studio/instance/admin-session';

let activeScopes = 0;
/** When set, proxied admin API calls go to KIRS project proxy instead of user Site Studio. */
let kirsProxyBaseOverride: string | null = null;
let kirsAdminSessionPathOverride: string | null = null;
/**
 * Origin of the public storefront (or runtime serving static files) for `/uploads/*`.
 * `<img src>` cannot send Bearer tokens; those URLs must not go through authenticated proxy.
 */
let publicUploadsOrigin: string | null = null;

/** Resolve origin from full public site URL (e.g. instance.public_url). */
export function publicOriginFromSiteUrl(
	url: string | null | undefined
): string | null {
	if (url == null || typeof url !== 'string') {
		return null;
	}
	const trimmed = url.trim();
	if (!trimmed) {
		return null;
	}
	try {
		return new URL(trimmed).origin;
	} catch {
		return null;
	}
}

function isAbsoluteUrl(url: string): boolean {
	return /^https?:\/\//i.test(url);
}

function normalizePath(url: string): string {
	if (!url) return '';
	if (isAbsoluteUrl(url)) {
		try {
			return new URL(url).pathname;
		} catch {
			return url;
		}
	}
	return url.startsWith('/') ? url : `/${url}`;
}

function isApiBaseUrl(baseURL?: string): boolean {
	if (!baseURL) {
		return false;
	}
	if (isAbsoluteUrl(baseURL)) {
		try {
			return new URL(baseURL).pathname.includes('/api');
		} catch {
			return baseURL.includes('/api');
		}
	}
	return baseURL.includes('/api');
}

export function activateSiteStudioProxy(): void {
	activeScopes += 1;
}

export function deactivateSiteStudioProxy(): void {
	activeScopes = Math.max(0, activeScopes - 1);
}

export function isSiteStudioProxyActive(): boolean {
	return activeScopes > 0;
}

/**
 * Scope Site Studio admin proxy to a KIRS marketing project (or clear for user Site Studio).
 * Pass `publicSiteUrl` so `/uploads/*` in admin resolve to the public storefront (img tags cannot use Bearer auth on proxy).
 */
export function setSiteStudioKirsProxyScope(
	projectId: string | null,
	publicSiteUrl?: string | null
): void {
	if (projectId) {
		kirsProxyBaseOverride = `/api/v1/desktop/kirs/projects/${projectId}/proxy`;
		kirsAdminSessionPathOverride = `/api/v1/desktop/kirs/projects/${projectId}/instance/admin-session`;
		publicUploadsOrigin = publicOriginFromSiteUrl(publicSiteUrl);
	} else {
		kirsProxyBaseOverride = null;
		kirsAdminSessionPathOverride = null;
		publicUploadsOrigin = null;
	}
}

/** User Site Studio embedded admin: set public origin for `/uploads` (cleared on unmount from shell). */
export function setSiteStudioPublicUploadsOrigin(origin: string | null): void {
	publicUploadsOrigin = origin;
}

export function getSiteStudioProxyRewriteBase(): string {
	return kirsProxyBaseOverride ?? SITE_STUDIO_PROXY_BASE;
}

export function getSiteStudioAdminSessionPostPath(): string {
	return kirsAdminSessionPathOverride ?? DEFAULT_ADMIN_SESSION_PATH;
}

export function rewriteSiteStudioProxyUrl(
	url?: string,
	baseURL?: string
): string | undefined {
	if (!url || !isSiteStudioProxyActive()) {
		return url;
	}
	if (isAbsoluteUrl(url)) {
		return url;
	}
	if (isApiBaseUrl(baseURL)) {
		return url;
	}

	const normalizedPath = normalizePath(url);
	if (publicUploadsOrigin && normalizedPath.startsWith('/uploads')) {
		const base = publicUploadsOrigin.replace(/\/$/, '');
		return `${base}${normalizedPath}`;
	}

	const proxyBase = getSiteStudioProxyRewriteBase();
	if (
		normalizedPath.startsWith('/api') ||
		normalizedPath.startsWith('/ws') ||
		normalizedPath.startsWith('/socket.io') ||
		normalizedPath.startsWith(SITE_STUDIO_PROXY_BASE) ||
		normalizedPath.startsWith(proxyBase)
	) {
		return url;
	}

	return `${proxyBase}${normalizedPath}`;
}

export { SITE_STUDIO_PROXY_BASE };
