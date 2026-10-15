/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Strip structured companion LLM envelopes (`{"visible_reply":…,"memory":…}`) and Gemma 4 /
 * llama-server channel control tokens before rendering chat bubbles.
 *
 * Invariants:
 * - Pure, never throws; returns trimmed input when no envelope/markup is detected.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - api/utils/llm_json_extract.py (strip_llm_channel_markup)
 * - documentation/product/ewa/EWA-COMPANION-VISIBLE-REPLY-FORMATTING.md
 */

import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

function jsonStringUnescape(raw: string): string {
	if (!raw) return '';
	try {
		return JSON.parse(`"${raw}"`) as string;
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_visible_reply_json_unescape',
			'visible_reply JSON string unescape failed',
			err
		);
		return raw.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
	}
}

function looseExtractVisibleReply(trimmed: string): string | null {
	const keyPos = trimmed.indexOf('"visible_reply"');
	if (keyPos < 0) return null;
	const colon = trimmed.indexOf(':', keyPos);
	if (colon < 0) return null;
	const openQ = trimmed.indexOf('"', colon + 1);
	if (openQ < 0) return null;
	for (const field of ['"memory"', '"actions"']) {
		const fk = trimmed.indexOf(field, openQ + 1);
		if (fk > openQ) {
			let segment = trimmed.slice(openQ + 1, fk).trimEnd();
			if (segment.endsWith(',')) segment = segment.slice(0, -1).trimEnd();
			if (segment.endsWith('"')) segment = segment.slice(0, -1);
			const out = jsonStringUnescape(segment).trim();
			if (out) return out;
		}
	}
	const closeBrace = trimmed.lastIndexOf('}', openQ);
	if (closeBrace > openQ) {
		let segment = trimmed.slice(openQ + 1, closeBrace).trimEnd();
		if (segment.endsWith(',')) segment = segment.slice(0, -1).trimEnd();
		if (segment.endsWith('"')) segment = segment.slice(0, -1);
		const out = jsonStringUnescape(segment).trim();
		return out || null;
	}
	return null;
}

/** Mirror of API ``strip_llm_channel_markup`` for Gemma 4 / llama-server control tokens. */
export function stripCompanionChannelMarkup(raw: string): string {
	let text = (raw ?? '').trim();
	if (!text) return text;
	text = text.replace(/<\/?think>/gi, '');
	text = text.replace(/<\|?channel\|>\s*/gi, '');
	text = text.replace(/<\|channel>(?:thought|\*)?\s*/gi, '');
	text = text.replace(/<\|[^>\n|]*\|?[^>\n]*>/gi, '');
	return text.trim();
}

/** User-facing assistant text only — never raw JSON envelope, channel markup, or empty memory tails. */
export function sanitizeCompanionVisibleReplyText(raw: string): string {
	const trimmed = stripCompanionChannelMarkup(raw ?? '');
	if (!trimmed.startsWith('{') || !trimmed.includes('"visible_reply"')) {
		return trimmed;
	}
	try {
		const parsed = JSON.parse(trimmed) as { visible_reply?: unknown };
		if (typeof parsed.visible_reply === 'string') {
			return stripCompanionChannelMarkup(parsed.visible_reply);
		}
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_visible_reply_sanitize',
			'visible_reply envelope JSON parse failed; trying loose extract',
			err
		);
		const loose = looseExtractVisibleReply(trimmed);
		if (loose) return stripCompanionChannelMarkup(loose);
	}
	return trimmed;
}
