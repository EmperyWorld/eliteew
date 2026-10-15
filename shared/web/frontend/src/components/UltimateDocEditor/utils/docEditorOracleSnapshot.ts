/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build oracle analytical snapshots (full O(N) word count) for sync boundaries
 * such as load, template insert, and draft restore.
 *
 * Invariants:
 * - Oracle stats always come from `countWordsFromHtml` (ground truth).
 *
 * Related:
 * - `utils/htmlWordCount.ts`, `store/slices/editorContentSlice.ts`
 */

import { countWordsFromHtml } from './htmlWordCount';

export interface DocEditorOracleSnapshot {
	content: string;
	words: number;
	characters: number;
}

export function buildDocEditorOracleSnapshot(
	html: string
): DocEditorOracleSnapshot {
	const { words, characters } = countWordsFromHtml(html);
	return { content: html, words, characters };
}
