/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Strip assistant Markdown to plain text safe for voice-gateway TTS (companion replies).
 *
 * Invariants:
 * - Best-effort only; never throws; caps length for synthesize API.
 *
 * Related:
 * - src/features/ewa/useEwaCompanionVoiceOutput.ts
 */
const TTS_MAX_CHARS = 1200;

/** Truncate at last word boundary before hard cap (full reply, not first-two-sentences). */
function truncateAtWord(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	const slice = text.slice(0, maxChars);
	const lastSpace = slice.lastIndexOf(' ');
	return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}

export function companionReplyToTtsPlainText(raw: string): string {
	let s = (raw ?? '').trim();
	if (!s) return '';

	s = s.replace(/```[\s\S]*?```/g, ' ');
	s = s.replace(/`([^`]+)`/g, '$1');
	s = s.replace(/^#{1,6}\s+/gm, '');
	s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
	s = s.replace(/\*([^*]+)\*/g, '$1');
	s = s.replace(/__([^_]+)__/g, '$1');
	s = s.replace(/_([^_]+)_/g, '$1');
	s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	s = s.replace(/^>\s?/gm, '');
	s = s.replace(/^[-*+]\s+/gm, '');
	s = s.replace(/^\d+\.\s+/gm, '');
	s = s.replace(/\|/g, ' ');
	s = s.replace(/\s+/g, ' ').trim();

	return truncateAtWord(s, TTS_MAX_CHARS);
}
