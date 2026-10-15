/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize Desktop AI Chat web-search source records from SSE traces and message metadata.
 *
 * Invariants:
 * - Only absolute HTTP(S) URLs without embedded credentials may reach source links.
 * - URL is required; title/snippet are optional display fields only.
 *
 * Related:
 * - DesktopAiWebSearchSources.tsx
 * - api/desktopChatClient.ts
 */

import type { DesktopAiStreamContextSummary } from './api/desktopChatClient';

export type DesktopAiWebSearchSource = {
	url: string;
	title?: string;
	snippet?: string;
};

const URL_LINE_RE = /^\s*URL:\s*(\S+)\s*$/gm;
const MAX_SOURCE_URL_LENGTH = 8192;

function safeWebSearchSourceUrl(value: unknown): string | null {
	const raw = String(value ?? '').trim();
	if (!raw || raw.length > MAX_SOURCE_URL_LENGTH) {
		return null;
	}
	try {
		const parsed = new URL(raw);
		if (
			(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
			!parsed.hostname ||
			parsed.username ||
			parsed.password
		) {
			return null;
		}
		return raw;
	} catch {
		return null;
	}
}

export function normalizeWebSearchSources(
	raw: unknown
): DesktopAiWebSearchSource[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	const out: DesktopAiWebSearchSource[] = [];
	const seen = new Set<string>();
	for (const row of raw) {
		if (!row || typeof row !== 'object') {
			continue;
		}
		const url = safeWebSearchSourceUrl((row as { url?: unknown }).url);
		if (!url || seen.has(url)) {
			continue;
		}
		seen.add(url);
		const titleRaw = (row as { title?: unknown }).title;
		const snippetRaw = (row as { snippet?: unknown }).snippet;
		const item: DesktopAiWebSearchSource = { url };
		if (typeof titleRaw === 'string' && titleRaw.trim()) {
			item.title = titleRaw.trim();
		}
		if (typeof snippetRaw === 'string' && snippetRaw.trim()) {
			item.snippet = snippetRaw.trim();
		}
		out.push(item);
	}
	return out;
}

export function parseWebSearchSourcesFromToolText(
	text: string
): DesktopAiWebSearchSource[] {
	const body = String(text || '').trim();
	if (!body) {
		return [];
	}
	const out: DesktopAiWebSearchSource[] = [];
	const seen = new Set<string>();
	const blockRe = /\[(\d+)\]\s*(.*?)\n\s*(.*?)\n\s*URL:\s*(\S+)/gs;
	for (const match of body.matchAll(blockRe)) {
		const url = safeWebSearchSourceUrl(match[4]);
		if (!url || seen.has(url)) {
			continue;
		}
		seen.add(url);
		const title = String(match[2] || '').trim();
		const snippet = String(match[3] || '').trim();
		out.push({
			url,
			...(title ? { title } : {}),
			...(snippet ? { snippet: snippet.slice(0, 400) } : {}),
		});
	}
	if (out.length > 0) {
		return out;
	}
	for (const match of body.matchAll(URL_LINE_RE)) {
		const url = safeWebSearchSourceUrl(match[1]);
		if (!url || seen.has(url)) {
			continue;
		}
		seen.add(url);
		out.push({ url });
	}
	return out;
}

export function webSearchSourcesFromToolsPayload(
	payload: unknown
): DesktopAiWebSearchSource[] {
	if (!payload || typeof payload !== 'object') {
		return [];
	}
	const trace = (payload as { trace?: unknown }).trace;
	if (!Array.isArray(trace)) {
		return [];
	}
	const merged: DesktopAiWebSearchSource[] = [];
	const seen = new Set<string>();
	const add = (items: DesktopAiWebSearchSource[]) => {
		for (const item of items) {
			if (seen.has(item.url)) {
				continue;
			}
			seen.add(item.url);
			merged.push(item);
		}
	};
	for (const row of trace) {
		if (!row || typeof row !== 'object') {
			continue;
		}
		const preview = (row as { preview?: unknown }).preview;
		if (typeof preview === 'string') {
			add(parseWebSearchSourcesFromToolText(preview));
		}
		const tools = (row as { tools?: unknown }).tools;
		if (Array.isArray(tools)) {
			for (const toolRow of tools) {
				if (!toolRow || typeof toolRow !== 'object') {
					continue;
				}
				const prev = (toolRow as { preview?: unknown }).preview;
				if (typeof prev === 'string') {
					add(parseWebSearchSourcesFromToolText(prev));
				}
			}
		}
	}
	return merged;
}

export function webSearchSourcesFromDonePayload(
	payload: unknown
): DesktopAiWebSearchSource[] {
	if (!payload || typeof payload !== 'object') {
		return [];
	}
	const direct = normalizeWebSearchSources(
		(payload as { web_search_sources?: unknown }).web_search_sources
	);
	if (direct.length > 0) {
		return direct;
	}
	const ctx = (payload as { context?: DesktopAiStreamContextSummary }).context;
	return normalizeWebSearchSources(ctx?.web_search_sources);
}

export function webSearchSourcesFromMessageMetadata(
	metadata: Record<string, unknown> | null | undefined
): DesktopAiWebSearchSource[] {
	const direct = normalizeWebSearchSources(
		metadata?.desktop_web_search_sources
	);
	if (direct.length > 0) {
		return direct;
	}
	const ctx = metadata?.context_summary;
	if (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) {
		return normalizeWebSearchSources(
			(ctx as DesktopAiStreamContextSummary).web_search_sources
		);
	}
	return [];
}

export function resolveMessageWebSearchSources(
	metadata: Record<string, unknown> | null | undefined
): DesktopAiWebSearchSource[] {
	return webSearchSourcesFromMessageMetadata(metadata);
}
