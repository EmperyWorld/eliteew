/**
 * LaTeX для @tiptap/extension-mathematics: без обёртки `$...$` — узел inlineMath хранит чистый latex.
 */
export function normalizeInlineMathLatex(raw: string): string {
	let s = raw.trim();
	if (s.length >= 2 && s.startsWith('$') && s.endsWith('$')) {
		s = s.slice(1, -1).trim();
	}
	return s;
}
