/**
 * Plain-text excerpts for Overview feed / cards — avoid dumping raw markdown into summary UI.
 */

const DEFAULT_MAX_LEN = 220;

/** Remove common markdown heading noise and duplicate executive-summary lines. */
export function stripMarkdownNoiseForOverview(text: string): string {
	let s = text.trim();
	s = s.replace(/^#{1,6}\s+/gm, '');
	s = s.replace(
		/^(Executive summary|Исполнительное резюме|EXECUTIVE SUMMARY)[^\n]*\n*/gim,
		''
	);
	s = s.replace(/\n{3,}/g, '\n\n');
	return s.trim();
}

/** Single-line excerpt for cards and activity rows. */
export function excerptOverviewPlaintext(
	text: string | null | undefined,
	maxLen: number = DEFAULT_MAX_LEN
): string {
	if (!text) return '';
	const stripped = stripMarkdownNoiseForOverview(text);
	const oneLine = stripped.replace(/\s+/g, ' ').trim();
	if (oneLine.length <= maxLen) return oneLine;
	return `${oneLine.slice(0, Math.max(0, maxLen - 1))}…`;
}
