/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared URL guards for Markdown/LLM-rendered content before links or images
 * become live browser navigation/fetch surfaces.
 *
 * Invariants:
 * - Protocol-relative URLs are never accepted; they hide the destination origin.
 * - External links must be absolute `http`/`https` URLs with a hostname.
 * - Remote Markdown images are denied by default except same-origin and known product media hosts.
 *
 * Related:
 * - src/components/assistantMessage/AssistantMessageRenderer.tsx
 * - src/features/ewa/EwaCompanionChatMarkdown.tsx
 */

const MAX_MARKDOWN_URL_LENGTH = 8192;

export function sanitizeMarkdownHref(
	href: string | undefined
): string | undefined {
	if (!href || typeof href !== 'string') return undefined;
	const trimmed = href.trim();
	if (!trimmed || trimmed.length > MAX_MARKDOWN_URL_LENGTH) return undefined;
	if (trimmed.startsWith('//')) return undefined;

	try {
		const parsed = new URL(trimmed);
		if (
			(parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
			parsed.hostname
		) {
			return trimmed;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function isSameOriginUrl(url: URL): boolean {
	return typeof window !== 'undefined' && url.origin === window.location.origin;
}

export function isTrustedMarkdownImageSrc(
	src: string | undefined
): src is string {
	if (!src || typeof src !== 'string') return false;
	const trimmed = src.trim();
	if (!trimmed || trimmed.length > MAX_MARKDOWN_URL_LENGTH) return false;
	if (trimmed.startsWith('//')) return false;

	try {
		const base =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://app.eliteew.ru';
		const parsed = new URL(trimmed, base);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return false;
		}
		if (isSameOriginUrl(parsed)) return true;

		const host = parsed.hostname.toLowerCase();
		return (
			host === 'eliteew.ru' ||
			host.endsWith('.eliteew.ru') ||
			host.endsWith('.r2.cloudflarestorage.com') ||
			host.includes('digitaloceanspaces.com') ||
			host.includes('storage.googleapis.com') ||
			host.endsWith('.blob.core.windows.net')
		);
	} catch {
		return false;
	}
}
