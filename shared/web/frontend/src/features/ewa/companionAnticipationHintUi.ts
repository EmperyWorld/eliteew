/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for proactive observation anticipation hints — episode line cleanup and
 * `suggested_action` coercion for clickable composer chips (Phase 5.3).
 *
 * Invariants:
 * - Unknown or empty `suggested_action` payloads yield `null` (no client-side invention).
 * - Chip labels come from server `prompt_text` / `quick_replies` only.
 *
 * Related:
 * - api/ewa_platform/companion/persona/anticipation.py
 * - src/features/ewa/CompanionAnticipationHintCard.tsx
 */

export type CompanionSuggestChatPromptAction = {
	type: 'suggest_chat_prompt';
	prompt_text: string;
};

export type CompanionProactiveReviewSuggestedAction = {
	type: 'proactive_review';
	quick_replies: string[];
};

export type CompanionAnticipationSuggestedAction =
	| CompanionSuggestChatPromptAction
	| CompanionProactiveReviewSuggestedAction;

/** Strip HCM tags and drop low-signal observation tails from related-episode bullets. */
export function normalizeAnticipationEpisodeLine(line: string): string | null {
	const withoutTag = line.replace(/^\[[^\]]+\]\s*/u, '').trim();
	if (!withoutTag) return null;
	if (
		/(^observation:|(?:^|\s)app=|(?:^|\s)title=|(?:^|\s)window_id=|(?:^|\s)workspace_id=)/iu.test(
			withoutTag
		)
	) {
		return null;
	}
	return withoutTag;
}

/** Coerce observation `suggested_action` into a typed chip source (or null). */
export function coerceCompanionAnticipationSuggestedAction(
	raw: Record<string, unknown> | null | undefined
): CompanionAnticipationSuggestedAction | null {
	if (!raw || typeof raw !== 'object') return null;
	const typeRaw =
		typeof raw.type === 'string'
			? raw.type.trim().toLowerCase()
			: typeof raw.kind === 'string'
				? raw.kind.trim().toLowerCase()
				: '';

	if (typeRaw === 'suggest_chat_prompt') {
		const promptSnake =
			typeof raw.prompt_text === 'string' ? raw.prompt_text.trim() : '';
		const promptCamel =
			typeof raw.promptText === 'string' ? raw.promptText.trim() : '';
		const text = promptSnake || promptCamel;
		if (!text) return null;
		return {
			type: 'suggest_chat_prompt',
			prompt_text: text.slice(0, 500),
		};
	}

	if (typeRaw === 'proactive_review') {
		const qr = raw.quick_replies ?? raw.quickReplies;
		if (!Array.isArray(qr)) return null;
		const replies = qr
			.map((row) => String(row ?? '').trim())
			.filter((row) => row.length > 0)
			.slice(0, 4);
		if (replies.length === 0) return null;
		return { type: 'proactive_review', quick_replies: replies };
	}

	return null;
}

/** Expand a coerced suggested action into chip labels (one or more quick-reply strings). */
export function anticipationSuggestedActionChips(
	action: CompanionAnticipationSuggestedAction
): string[] {
	if (action.type === 'suggest_chat_prompt') {
		return [action.prompt_text];
	}
	return action.quick_replies;
}

export function anticipationSuggestedActionIcon(
	action: CompanionAnticipationSuggestedAction | null
): 'icon-pulse' | 'icon-ewa-brain' | 'icon-ewa-analytics' {
	if (!action) return 'icon-ewa-brain';
	if (action.type === 'proactive_review') return 'icon-ewa-analytics';
	return 'icon-pulse';
}
