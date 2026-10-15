/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse Kursorina SWOT / risk GFM tables into structured editorial models.
 *
 * Invariants:
 * - Pure / deterministic; no network.
 * - Returns null when the table is not the expected shape.
 *
 * Related:
 * - shared/api/services/kursorina/tools.py (swot_matrix_analysis, risk_matrix_assessment)
 * - KursorinaReportMarkdown.tsx
 */

export type SwotQuadrantKey =
	| 'strengths'
	| 'weaknesses'
	| 'opportunities'
	| 'threats';

export type ParsedSwot = {
	title: string;
	quadrants: Record<SwotQuadrantKey, string[]>;
};

export type ParsedRiskRow = {
	category: string;
	name: string;
	probability: number;
	impact: number;
	score: number;
	level: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
	mitigation: string;
};

export type ParsedRiskMatrix = {
	title: string;
	rows: ParsedRiskRow[];
};

export type ReportPart =
	| { type: 'markdown'; text: string }
	| { type: 'swot'; data: ParsedSwot }
	| { type: 'risk'; data: ParsedRiskMatrix };

function splitItems(cell: string): string[] {
	return cell
		.replace(/<br\s*\/?>/gi, '\n')
		.split(/\n|•/)
		.map((s) => s.replace(/\*\*/g, '').trim())
		.filter(Boolean);
}

function classifyQuadrant(label: string): SwotQuadrantKey | null {
	const t = label.toLowerCase();
	if (t.includes('strength') || t.includes('сильн')) return 'strengths';
	if (t.includes('weakness') || t.includes('слаб')) return 'weaknesses';
	if (t.includes('opportunit') || t.includes('возможност'))
		return 'opportunities';
	if (t.includes('threat') || t.includes('угроз')) return 'threats';
	return null;
}

function isTableSeparator(line: string): boolean {
	return /^\|?\s*:?-{3,}/.test(line.trim());
}

function parsePipeRow(line: string): string[] {
	const t = line.trim();
	if (!t.includes('|')) return [];
	const raw = t.replace(/^\|/, '').replace(/\|$/, '');
	return raw.split('|').map((c) => c.trim());
}

function classifyRiskLevel(raw: string): ParsedRiskRow['level'] {
	const t = raw.toLowerCase();
	if (t.includes('крит')) return 'critical';
	if (t.includes('высок')) return 'high';
	if (t.includes('средн')) return 'medium';
	if (t.includes('низк')) return 'low';
	return 'unknown';
}

function takeHeadingTitle(buf: string[]): string | null {
	const last = buf.at(-1)?.trim() ?? '';
	const m = /^#{2,3}\s+(.+)$/.exec(last);
	return m ? m[1].trim() : null;
}

/** Detect SWOT 2-column table starting at `lines[start]`. */
export function tryParseSwotTable(
	lines: string[],
	start: number
): { data: ParsedSwot; end: number } | null {
	const header = parsePipeRow(lines[start] ?? '');
	if (header.length < 2) return null;
	const h0 = header[0].toLowerCase();
	const h1 = header[1].toLowerCase();
	if (!h0.includes('квадрант') && !h0.includes('quadrant')) return null;
	if (
		!h1.includes('фактор') &&
		!h1.includes('factor') &&
		!h1.includes('характер')
	) {
		return null;
	}

	let i = start + 1;
	if (isTableSeparator(lines[i] ?? '')) i += 1;

	const quadrants: Record<SwotQuadrantKey, string[]> = {
		strengths: [],
		weaknesses: [],
		opportunities: [],
		threats: [],
	};
	let found = 0;
	while (i < lines.length) {
		const row = parsePipeRow(lines[i] ?? '');
		if (row.length < 2) break;
		const key = classifyQuadrant(row[0]);
		if (!key) break;
		quadrants[key] = splitItems(row[1]);
		found += 1;
		i += 1;
	}
	if (found < 2) return null;
	return { data: { title: 'SWOT', quadrants }, end: i };
}

/** Detect risk assessment table starting at `lines[start]`. */
export function tryParseRiskTable(
	lines: string[],
	start: number
): { data: ParsedRiskMatrix; end: number } | null {
	const header = parsePipeRow(lines[start] ?? '');
	if (header.length < 5) return null;
	const joined = header.join(' ').toLowerCase();
	if (!joined.includes('категория') && !joined.includes('category'))
		return null;
	if (!joined.includes('риск') && !joined.includes('risk')) return null;
	if (
		!joined.includes('индекс') &&
		!joined.includes('p×i') &&
		!joined.includes('p*i') &&
		!joined.includes('p x i')
	) {
		return null;
	}

	let i = start + 1;
	if (isTableSeparator(lines[i] ?? '')) i += 1;

	const rows: ParsedRiskRow[] = [];
	while (i < lines.length) {
		const row = parsePipeRow(lines[i] ?? '');
		if (row.length < 5) break;
		const scoreRaw = row[4]?.replace(/\*\*/g, '') ?? '';
		const score = Number.parseInt(scoreRaw, 10);
		rows.push({
			category: row[0]?.replace(/\*\*/g, '') ?? '',
			name: row[1]?.replace(/\*\*/g, '') ?? '',
			probability: Number.parseInt(row[2] ?? '0', 10) || 0,
			impact: Number.parseInt(row[3] ?? '0', 10) || 0,
			score: Number.isFinite(score) ? score : 0,
			level: classifyRiskLevel(row[5] ?? ''),
			mitigation: (row[6] ?? '').replace(/\*\*/g, '').trim(),
		});
		i += 1;
	}
	if (rows.length === 0) return null;
	return { data: { title: 'Риски', rows }, end: i };
}

/**
 * Split report markdown into prose segments and editorial matrices.
 * Consumes a preceding ##/### heading as the matrix title when present.
 */
export function splitKursorinaReportParts(source: string): ReportPart[] {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const parts: ReportPart[] = [];
	let buf: string[] = [];

	const flushMd = () => {
		const text = buf.join('\n');
		buf = [];
		if (text.trim()) parts.push({ type: 'markdown', text });
	};

	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? '';
		if (line.trim().startsWith('|')) {
			const swot = tryParseSwotTable(lines, i);
			if (swot) {
				const heading = takeHeadingTitle(buf);
				if (heading) buf = buf.slice(0, -1);
				flushMd();
				parts.push({
					type: 'swot',
					data: { ...swot.data, title: heading || swot.data.title },
				});
				i = swot.end;
				continue;
			}
			const risk = tryParseRiskTable(lines, i);
			if (risk) {
				const heading = takeHeadingTitle(buf);
				if (heading) buf = buf.slice(0, -1);
				flushMd();
				parts.push({
					type: 'risk',
					data: { ...risk.data, title: heading || risk.data.title },
				});
				i = risk.end;
				continue;
			}
		}
		buf.push(line);
		i += 1;
	}
	flushMd();
	return parts.length > 0 ? parts : [{ type: 'markdown', text: source }];
}
