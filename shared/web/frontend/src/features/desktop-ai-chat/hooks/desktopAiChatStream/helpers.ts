/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Desktop AI Chat SSE stream orchestration (abort detection,
 * web-search flag resolution, assistant id extraction, tools trace formatting).
 *
 * Invariants:
 * - No React hooks or side effects; safe for unit tests and stream handlers.
 *
 * Related:
 * - hooks/desktopAiChatStream/useDesktopAiChatStreamRun.ts
 * - hooks/desktopAiChatStream/streamEventHandlers.ts
 */
import type { TFunction } from 'i18next';
import type { DesktopAiMessage } from '../../api/desktopChatClient';
import {
	webSearchSourcesFromToolsPayload,
	type DesktopAiWebSearchSource,
} from '../../desktopWebSearchSources';

export function isAbortError(e: unknown): boolean {
	if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
		return e.name === 'AbortError';
	}
	return e instanceof Error && e.name === 'AbortError';
}

export function resolveUseWebSearchFlag(opts: {
	useWebSearch: boolean;
	useTools: boolean;
	isEnsemble: boolean;
	adminEnabled: boolean;
	override?: boolean;
}): boolean {
	const on = opts.override ?? opts.useWebSearch;
	if (!on || !opts.adminEnabled) {
		return false;
	}
	return opts.isEnsemble || opts.useTools;
}

export function assistantIdsAfterLastUser(items: DesktopAiMessage[]): string[] {
	let lastUserIdx = -1;
	for (let i = items.length - 1; i >= 0; i -= 1) {
		if (items[i]?.role === 'user') {
			lastUserIdx = i;
			break;
		}
	}
	if (lastUserIdx < 0) {
		return [];
	}
	return items
		.slice(lastUserIdx + 1)
		.filter((row) => row.role === 'assistant')
		.map((row) => row.id);
}

export function formatToolsTraceSummary(
	payload: unknown,
	t: TFunction<'desktopAiChat'>
): { summary: string; sources: DesktopAiWebSearchSource[] } {
	const sources = webSearchSourcesFromToolsPayload(payload);
	const p = payload as { trace?: unknown[] };
	const trace = p.trace;
	if (!Array.isArray(trace) || trace.length === 0) {
		const summary =
			sources.length > 0
				? [
						t('toolsTraceWebSearch', { count: sources.length }),
						...sources.slice(0, 6).map((s) =>
							t('toolsTraceWebSearchUrl', {
								label: s.title?.trim() || s.url,
							})
						),
					].join('\n')
				: t('toolsTraceDone');
		return { summary, sources };
	}
	const lines: string[] = [];
	if (sources.length > 0) {
		lines.push(t('toolsTraceWebSearch', { count: sources.length }));
		for (const source of sources.slice(0, 6)) {
			lines.push(
				t('toolsTraceWebSearchUrl', {
					label: source.title?.trim() || source.url,
				})
			);
		}
	}
	for (const round of trace) {
		if (typeof round !== 'object' || round === null) {
			continue;
		}
		const r = round as Record<string, unknown>;
		if (r.final) {
			const prev = r.preview;
			const snip =
				typeof prev === 'string' && prev.length > 0
					? `${prev.slice(0, 120)}${prev.length > 120 ? '…' : ''}`
					: '…';
			lines.push(t('toolsTraceAnswer', { snippet: snip }));
		}
		if (Array.isArray(r.tools)) {
			for (const x of r.tools) {
				if (typeof x !== 'object' || x === null) {
					continue;
				}
				const o = x as Record<string, unknown>;
				const name =
					o.name != null ? String(o.name) : t('toolsTraceToolFallback');
				if (name === 'web_search' || name === 'desktop_web_search') {
					continue;
				}
				lines.push(t('toolsTraceBullet', { name }));
			}
		}
		if (r.ensemble_prefetch === true && r.name === 'web_search') {
			lines.push(t('toolsTraceWebSearchPrefetch'));
		}
		if (r.error != null) {
			lines.push(t('toolsTraceError', { message: String(r.error) }));
		}
	}
	const summary = lines.slice(0, 12).join('\n') || t('toolsTraceFallback');
	return { summary, sources };
}
