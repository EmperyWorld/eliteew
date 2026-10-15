/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse Desktop AI Chat SSE data payloads and extract done-event context summaries.
 *
 * Invariants:
 * - Ignores keep-alive comment lines and malformed JSON blocks.
 * - Context extraction is metadata-only (no chunk bodies).
 *
 * Related:
 * - api/desktopChatClient.ts
 * - desktopChatContextSummary.ts
 */

import type { DesktopAiStreamContextSummary } from './api/desktopChatClient';

export function parseDesktopAiSseDataPayloads(
	raw: string
): Record<string, unknown>[] {
	const out: Record<string, unknown>[] = [];
	const blocks = raw.split('\n\n');
	for (const block of blocks) {
		for (const line of block.split('\n')) {
			if (line.startsWith(':')) {
				continue;
			}
			if (!line.startsWith('data:')) {
				continue;
			}
			const payload = line.slice(5).trim();
			if (!payload) {
				continue;
			}
			try {
				const parsed: unknown = JSON.parse(payload);
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					out.push(parsed as Record<string, unknown>);
				}
			} catch {
				/* skip malformed */
			}
		}
	}
	return out;
}

export function extractDoneStreamContext(
	payload: unknown
): DesktopAiStreamContextSummary | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}
	const ctx = (payload as { context?: unknown }).context;
	if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
		return null;
	}
	return ctx as DesktopAiStreamContextSummary;
}

export function findLastDoneContextFromSse(
	raw: string
): DesktopAiStreamContextSummary | null {
	const events = parseDesktopAiSseDataPayloads(raw);
	for (let i = events.length - 1; i >= 0; i -= 1) {
		const ev = events[i];
		if (ev.event !== 'done') {
			continue;
		}
		const ctx = extractDoneStreamContext(ev);
		if (ctx) {
			return ctx;
		}
	}
	return null;
}
