/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pre-parse repairs for companion chat Markdown (GFM tables, jammed ATX headings) before ReactMarkdown.
 *
 * Invariants:
 * - Code fences are never modified; table repair runs line-wise outside ``` blocks only.
 * - Closing a runaway table inserts a blank line so remark-gfm starts a new block.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatMarkdown.tsx
 */

function normalizeNewlines(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** GFM table row: leading pipe or trailing pipe with at least two cell delimiters. */
export function isCompanionGfmTableRowLine(line: string): boolean {
	const t = line.trim();
	if (!t.includes('|')) return false;
	if (/^#{1,6}\s/.test(t)) return false;
	if (/^```/.test(t)) return false;
	if (/^>\s/.test(t)) return false;
	if (/^\|/.test(t)) return true;
	return /\|$/.test(t) && t.split('|').length >= 3;
}

export function countCompanionGfmTableColumns(line: string): number | null {
	if (!isCompanionGfmTableRowLine(line)) return null;
	let s = line.trim();
	if (s.startsWith('|')) s = s.slice(1);
	if (s.endsWith('|')) s = s.slice(0, -1);
	return s.split('|').length;
}

export function isCompanionGfmTableSeparatorLine(line: string): boolean {
	const cols = countCompanionGfmTableColumns(line);
	if (cols === null || cols < 1) return false;
	let s = line.trim();
	if (s.startsWith('|')) s = s.slice(1);
	if (s.endsWith('|')) s = s.slice(0, -1);
	return s.split('|').every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function isNonTableBlockLine(line: string): boolean {
	const t = line.trim();
	if (!t) return false;
	return (
		/^#{1,6}\s/.test(t) ||
		/^```/.test(t) ||
		/^-{3,}\s*$/.test(t) ||
		/^\*{3,}\s*$/.test(t) ||
		/^>\s/.test(t) ||
		/^[-*+]\s/.test(t) ||
		/^\d+\.\s/.test(t)
	);
}

type TableScanState = 'idle' | 'header' | 'ready';

/**
 * Terminate GFM tables when the model keeps appending prose/list/heading lines as fake rows,
 * or when column counts drift (extra `|` inside a cell absorbs the rest of the message).
 */
export function repairCompanionGfmTableBoundaries(markdown: string): string {
	const parts = markdown.split(/(```[\s\S]*?```)/g);
	return parts
		.map((chunk, idx) => {
			if (idx % 2 === 1) return chunk;

			const lines = chunk.split('\n');
			const out: string[] = [];
			let state: TableScanState = 'idle';
			let expectedCols = 0;

			const closeTable = () => {
				state = 'idle';
				expectedCols = 0;
			};

			for (const line of lines) {
				const trimmed = line.trim();

				if (!trimmed) {
					closeTable();
					out.push(line);
					continue;
				}

				if (isNonTableBlockLine(line)) {
					if (state !== 'idle') {
						out.push('');
						closeTable();
					}
					out.push(line);
					continue;
				}

				const cols = countCompanionGfmTableColumns(line);
				const isRow = cols !== null;
				const isSep = isRow && isCompanionGfmTableSeparatorLine(line);

				if (state === 'idle') {
					if (isRow && cols >= 2 && !isSep) {
						state = 'header';
						expectedCols = cols;
						out.push(line);
					} else {
						out.push(line);
					}
					continue;
				}

				if (state === 'header') {
					if (isSep && cols === expectedCols) {
						state = 'ready';
						out.push(line);
						continue;
					}
					out.push('');
					closeTable();
					if (isRow && cols >= 2 && !isSep) {
						state = 'header';
						expectedCols = cols;
					}
					out.push(line);
					continue;
				}

				// state === 'ready' (body)
				if (!isRow || cols !== expectedCols) {
					out.push('');
					closeTable();
					if (isRow && cols !== null && cols >= 2 && !isSep) {
						state = 'header';
						expectedCols = cols;
					}
					out.push(line);
					continue;
				}

				if (isSep) {
					out.push('');
					closeTable();
					out.push(line);
					continue;
				}

				out.push(line);
			}

			return out.join('\n');
		})
		.join('');
}

/**
 * Model often emits ATX headings inline: «…текст # Заголовок» without newline.
 * Split only outside fenced code blocks.
 */
export function normalizeCompanionJammedAtxHeadings(markdown: string): string {
	const parts = markdown.split(/(```[\s\S]*?```)/g);
	return parts
		.map((chunk, idx) => {
			if (idx % 2 === 1) return chunk;
			let s = chunk;
			for (let n = 0; n < 16; n++) {
				const next = s.replace(
					/(.+?)(\s+)(#{1,6}\s+\S[^\n#]*)/g,
					(_m, pre: string, sp: string, heading: string) => {
						if (pre.includes('\n') || /#\s*$/.test(pre)) {
							return `${pre}${sp}${heading}`;
						}
						if (/(?:\/\/|\[)/.test(pre.slice(-12))) {
							return `${pre}${sp}${heading}`;
						}
						return `${pre.trimEnd()}\n\n${heading}`;
					}
				);
				if (next === s) break;
				s = next;
			}
			return s;
		})
		.join('');
}

/**
 * Models frequently emit LaTeX math snippets for simple arrows and symbols:
 * `«Запрос $\rightarrow$ Ответ»`, `$> 0.85$`, `$P \times I$`.
 * Normalize these outside fenced code blocks to clean Unicode characters.
 */
export function normalizeLatexMathSymbols(markdown: string): string {
	const parts = markdown.split(/(```[\s\S]*?```)/g);
	return parts
		.map((chunk, idx) => {
			if (idx % 2 === 1) return chunk;
			let s = chunk;
			s = s.replace(/\$\\rightarrow\$|\\rightarrow\b/g, '→');
			s = s.replace(/\$\\leftarrow\$|\\leftarrow\b/g, '←');
			s = s.replace(/\$\\Rightarrow\$|\\Rightarrow\b/g, '⇒');
			s = s.replace(/\$\\Leftarrow\$|\\Leftarrow\b/g, '⇐');
			s = s.replace(/\$\\leftrightarrow\$|\\leftrightarrow\b/g, '↔');
			s = s.replace(/\$\\times\$|\\times\b/g, '×');
			s = s.replace(/\$\\cdot\$|\\cdot\b/g, '·');
			s = s.replace(/\$\\le\$|\$\\leq\$|\\leq\b|\\le\b/g, '≤');
			s = s.replace(/\$\\ge\$|\$\\geq\$|\\geq\b|\\ge\b/g, '≥');
			s = s.replace(/\$\\approx\$|\\approx\b/g, '≈');
			s = s.replace(/\$\\neq\$|\\neq\b/g, '≠');
			s = s.replace(/\$\\pm\$|\\pm\b/g, '±');
			s = s.replace(/\$\\Sigma\$|\\Sigma\b/g, 'Σ');
			s = s.replace(/\$\\Delta\$|\\Delta\b/g, 'Δ');
			s = s.replace(/\$\\alpha\$|\\alpha\b/g, 'α');
			s = s.replace(/\$\\beta\$|\\beta\b/g, 'β');
			s = s.replace(/\$\s*([><]=?)\s*([0-9.]+)\s*\$/g, '$1 $2');
			s = s.replace(
				/\$\s*([A-Za-z0-9_]+)\s*(?:\\times|×)\s*([A-Za-z0-9_]+)\s*\$/g,
				'$1 × $2'
			);
			s = s.replace(/\$([A-Za-z0-9_]+)\$/g, '$1');
			return s;
		})
		.join('');
}

/** Full companion markdown normalize pass before remark-gfm. */
export function normalizeCompanionChatMarkdown(markdown: string): string {
	const body = normalizeNewlines(markdown ?? '').trim();
	if (!body) return '';
	return normalizeLatexMathSymbols(
		normalizeCompanionJammedAtxHeadings(repairCompanionGfmTableBoundaries(body))
	);
}
