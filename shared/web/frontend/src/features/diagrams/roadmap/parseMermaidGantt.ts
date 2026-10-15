/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse Mermaid gantt fence text into structured phases for editorial timeline UI.
 *
 * Invariants:
 * - Pure / deterministic; no Mermaid library.
 * - Returns null when the source is not a gantt or yields no tasks.
 *
 * Related:
 * - RoadmapTimeline.tsx
 * - DesktopAiChatMarkdown.mermaid.tsx (MermaidFenceBlock)
 * - shared/api/services/kursorina/tools.py (generate_timeline_roadmap)
 */

export type GanttTask = {
	section: string;
	name: string;
	id: string;
	/** ISO date or `after <id>` / empty */
	when: string;
	/** e.g. 45d, 2w */
	duration: string;
};

export type ParsedGantt = {
	title: string;
	tasks: GanttTask[];
};

export function isMermaidGanttSource(source: string): boolean {
	const t = source.replace(/^\s*mermaid\s*\r?\n/i, '').trim();
	return /^gantt\b/i.test(t);
}

/** Humanize `45d` / `2w` / `3m` for RU chrome. */
export function formatGanttDuration(raw: string): string {
	const s = raw.trim().toLowerCase();
	const m = /^(\d+)\s*([dwm])$/.exec(s);
	if (!m) return raw.trim();
	const n = Number(m[1]);
	const unit = m[2];
	if (unit === 'd') return `${n} дн.`;
	if (unit === 'w') return `${n} нед.`;
	return `${n} мес.`;
}

export function formatGanttWhen(when: string): string {
	const w = when.trim();
	if (!w) return '';
	if (/^after\s+/i.test(w)) return 'после предыдущего этапа';
	if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
		const [y, mo, d] = w.split('-');
		return `${d}.${mo}.${y}`;
	}
	return w;
}

/**
 * Best-effort Mermaid gantt line parser (Kursorina / LLM shapes).
 * Task line: `Name :id, 2026-09-15, 45d` or `Name :id, after a1, 60d`
 */
export function parseMermaidGantt(source: string): ParsedGantt | null {
	if (!isMermaidGanttSource(source)) return null;
	const body = source.replace(/^\s*mermaid\s*\r?\n/i, '').trim();
	const lines = body.split(/\r?\n/);
	let title = '';
	let section = 'Этап';
	const tasks: GanttTask[] = [];

	for (const lineRaw of lines) {
		const line = lineRaw.trim();
		if (!line || line.toLowerCase() === 'gantt') continue;
		if (/^dateformat\b/i.test(line)) continue;
		if (/^excludes\b/i.test(line)) continue;
		if (/^todaymarker\b/i.test(line)) continue;
		if (/^axisformat\b/i.test(line)) continue;
		if (/^tickinterval\b/i.test(line)) continue;

		const titleMatch = /^title\s+(.+)$/i.exec(line);
		if (titleMatch) {
			title = titleMatch[1].trim();
			continue;
		}
		const sectionMatch = /^section\s+(.+)$/i.exec(line);
		if (sectionMatch) {
			section = sectionMatch[1].trim() || section;
			continue;
		}

		const taskMatch = /^(.+?)\s*:\s*(.+)$/.exec(line);
		if (!taskMatch) continue;
		const name = taskMatch[1].trim();
		const meta = taskMatch[2].trim();
		const parts = meta
			.split(',')
			.map((p) => p.trim())
			.filter(Boolean);
		if (parts.length === 0) continue;

		let id = '';
		let when = '';
		let duration = '';

		if (parts.length >= 3) {
			id = parts[0];
			when = parts[1];
			duration = parts[2];
		} else if (parts.length === 2) {
			if (
				/^(after\s+)/i.test(parts[0]) ||
				/^\d{4}-\d{2}-\d{2}$/.test(parts[0])
			) {
				when = parts[0];
				duration = parts[1];
				id = `t${tasks.length + 1}`;
			} else {
				id = parts[0];
				duration = parts[1];
			}
		} else {
			id = parts[0];
		}

		const cleanName = name.replace(/^(done|active|crit)\s+/i, '').trim();
		if (!cleanName) continue;

		tasks.push({
			section,
			name: cleanName,
			id: id || `t${tasks.length + 1}`,
			when,
			duration,
		});
	}

	if (tasks.length === 0) return null;
	return { title: title || 'Дорожная карта', tasks };
}
