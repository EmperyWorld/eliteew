/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize council Process-tab turn text for markdown render (strip duplicate ATX headings).
 *
 * Invariants:
 * - Document-tab bodies use `document_text` / assembled markdown — not this helper.
 *
 * Related:
 * - components/DesktopAiCouncilProcessPanel.tsx
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

/** Strip leading ## section title when the article header already names the speaker/zone. */
export function stripCouncilProcessTurnMarkdown(text: string): string {
	const raw = text.replace(/\r\n/g, '\n').trim();
	if (!raw) {
		return raw;
	}
	const lines = raw.split('\n');
	const first = lines[0]?.trim() ?? '';
	const headingMatch = /^#{1,6}\s+(.+)$/.exec(first);
	if (!headingMatch) {
		return raw;
	}
	return lines.slice(1).join('\n').replace(/^\n+/, '').trim();
}
