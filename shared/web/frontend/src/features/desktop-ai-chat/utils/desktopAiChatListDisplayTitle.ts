/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize Desktop AI Chat sidebar list titles / secondary labels (no duplicate
 * «Команда» + uppercase badge, no «Чат: …» + redundant assistant line).
 *
 * Invariants:
 * - Display-only; does not mutate persisted chat.title.
 *
 * Related:
 * - components/DesktopAiChatSidebar.tsx
 * - i18n desktopAiChat.newChatTitleEnsemble / defaultAssistant
 */

const LEGACY_ENSEMBLE_TITLES = new Set([
	'Чат: Команда',
	'Chat: Team',
	'Chat: Ensemble',
	'Команда',
	'Team',
	'Ensemble',
]);

const CHAT_PREFIX_RE = /^(?:чат|chat)\s*:\s*/i;

function normalizeLoose(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

/** Strip legacy «Чат:» / «Chat:» prefix without inventing content. */
export function stripDesktopAiChatTitlePrefix(title: string): string {
	return title.trim().replace(CHAT_PREFIX_RE, '').trim();
}

export function desktopAiChatListDisplayTitle(
	title: string | null | undefined,
	fallback: string
): string {
	const raw = (title ?? '').trim();
	if (!raw) return fallback;
	const stripped = stripDesktopAiChatTitlePrefix(raw);
	if (!stripped) return fallback;
	if (LEGACY_ENSEMBLE_TITLES.has(raw) || LEGACY_ENSEMBLE_TITLES.has(stripped)) {
		return fallback;
	}
	return stripped;
}

export function isDesktopAiChatGenericTeamTitle(
	title: string,
	teamFallback: string
): boolean {
	const n = normalizeLoose(title);
	const f = normalizeLoose(teamFallback);
	return (
		n === f ||
		n === 'команда' ||
		n === 'team' ||
		n === 'ensemble' ||
		n === 'чат: команда' ||
		n === 'chat: team'
	);
}

/**
 * Primary row title: prefer roster preview when ensemble title is still the generic «Команда».
 */
export function desktopAiChatListPrimaryTitle(input: {
	title: string | null | undefined;
	isEnsemble: boolean;
	teamFallback: string;
	soloFallback: string;
	rosterPreview: string;
}): string {
	const base = desktopAiChatListDisplayTitle(
		input.title,
		input.isEnsemble ? input.teamFallback : input.soloFallback
	);
	if (
		input.isEnsemble &&
		isDesktopAiChatGenericTeamTitle(base, input.teamFallback) &&
		input.rosterPreview.trim()
	) {
		return input.rosterPreview.trim();
	}
	return base;
}

/**
 * Secondary line / mode chip — null when it would only repeat the primary title
 * or when ensemble mode is already obvious from roster/card chrome.
 */
export function desktopAiChatListSecondaryLabel(input: {
	primaryTitle: string;
	sideLabel: string;
	isEnsemble: boolean;
	isShared: boolean;
	sharedBadge: string | null;
}): { kind: 'shared' | 'solo'; label: string } | null {
	const primary = normalizeLoose(input.primaryTitle);
	if (input.isShared && input.sharedBadge) {
		return { kind: 'shared', label: input.sharedBadge };
	}
	if (input.isEnsemble) {
		// Team mode is already signaled by card chrome + roster avatars.
		return null;
	}
	const side = input.sideLabel.trim();
	if (!side) return null;
	if (primary === normalizeLoose(side)) return null;
	if (primary.includes(normalizeLoose(side))) return null;
	return { kind: 'solo', label: side };
}
