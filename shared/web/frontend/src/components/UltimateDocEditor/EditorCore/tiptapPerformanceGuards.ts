/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small pure performance guards for TipTap editor transaction handlers.
 *
 * Invariants:
 * - Selection signatures are computed before expensive `doc.textBetween` calls.
 * - The signature includes document size so same-range replacements are not always skipped.
 *
 * Related:
 * - src/components/UltimateDocEditor/EditorCore/TiptapEditor.tsx
 */

export function buildTiptapSelectionRangeSignature({
	from,
	to,
	docContentSize,
}: {
	from: number;
	to: number;
	docContentSize: number;
}): string {
	return `${from}:${to}:${docContentSize}`;
}

export function shouldSkipTiptapSelectionWork(
	previousSignature: string,
	nextSignature: string
): boolean {
	return previousSignature === nextSignature;
}
