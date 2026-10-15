/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Process-local cache of sanitized Mermaid SVG for Desktop AI Chat fences.
 * Avoids re-running mermaid.render after ReactMarkdown remounts the fence.
 *
 * Invariants:
 * - Keys include theme config identity (version + palette) so theme bumps invalidate SVG.
 * - Values are already sanitizeMermaidSvg outputs (safe to assign via innerHTML).
 * - clearDesktopAiChatMermaidSvgCache is for tests only.
 *
 * Related:
 * - DesktopAiChatMarkdown.tsx ChatMermaidBlock
 */

const cache = new Map<string, string>();

/** Cap entries so long sessions with many unique diagrams do not grow without bound. */
const MAX_ENTRIES = 48;

function cacheKey(source: string, configId: string | number): string {
	return `v${configId}\n${source.trim()}`;
}

export function getDesktopAiChatMermaidSvgCache(
	source: string,
	configId: string | number = 0
): string | null {
	if (!source.trim()) return null;
	return cache.get(cacheKey(source, configId)) ?? null;
}

export function setDesktopAiChatMermaidSvgCache(
	source: string,
	safeSvg: string,
	configId: string | number = 0
): void {
	const trimmed = source.trim();
	if (!trimmed || !safeSvg) return;
	const key = cacheKey(trimmed, configId);
	if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) {
			cache.delete(oldest);
		}
	}
	cache.set(key, safeSvg);
}

export function clearDesktopAiChatMermaidSvgCache(): void {
	cache.clear();
}
