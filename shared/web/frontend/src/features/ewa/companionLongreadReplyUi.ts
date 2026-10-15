/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect companion social-post / longread replies (`social_post_compose` terminal format) so the chat UI can
 * render them with compact typography without shrinking normal assistant messages.
 *
 * Invariants:
 * - Heuristic only — matches server reply shape (`**Лонгрид…**`, `---` copy block), not message length.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatMarkdown.tsx
 * - api/ewa_platform/companion/orchestration/companion_social_post_compose.py
 */

/** True when assistant reply is a copy-ready longread from ``social_post_compose``. */
export function isCompanionLongreadReply(markdown: string): boolean {
	const s = (markdown ?? '').trim();
	if (!s) return false;
	if (/^\*\*(?:Лонгрид|Long-form post|Long-form)(?:\s|\*\*)/i.test(s))
		return true;
	if (/^\*\*Готовый (?:пост|текст)/i.test(s) && /\n---\n[\s\S]+\n---\n/.test(s))
		return true;
	if (/^\*\*Ready-to-publish post/i.test(s) && /\n---\n[\s\S]+\n---\n/.test(s))
		return true;
	return false;
}

/** Text to copy: post body between ``---`` when present, else full assistant message. */
export function extractCompanionCopyText(markdown: string): string {
	const s = (markdown ?? '').trim();
	if (!s) return '';
	const match = s.match(/\n---\n([\s\S]*?)\n---\n/);
	if (match?.[1]?.trim()) return match[1].trim();
	return s;
}
