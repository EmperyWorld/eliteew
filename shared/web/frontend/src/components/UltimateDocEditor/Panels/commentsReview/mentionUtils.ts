/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mention handle normalization and @-query parsing for comment composer/reply.
 *
 * Invariants:
 * - Handles are lowercase, trimmed, max 32 chars.
 *
 * Related:
 * - useCommentMentions.ts, CommentsReviewComposer.tsx
 */

export function normalizeMentionHandle(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_.-]/g, '')
		.slice(0, 32);
}

export function resolveActiveMentionQuery(value: string): string | null {
	const match = value.match(/(?:^|\s)@([a-z0-9_.-]*)$/i);
	if (!match) {
		return null;
	}

	return (match[1] ?? '').toLowerCase();
}

export function applyMentionToText(
	source: string,
	candidateHandle: string
): string {
	return source.replace(/@([a-z0-9_.-]*)$/i, `@${candidateHandle} `);
}
