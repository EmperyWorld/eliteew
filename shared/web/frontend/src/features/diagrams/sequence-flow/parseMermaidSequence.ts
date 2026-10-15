/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse Mermaid sequenceDiagram fence text into ordered message turns for
 * editorial SequenceFlow UI (not Mermaid SVG).
 *
 * Invariants:
 * - Pure / deterministic; no Mermaid library.
 * - Returns null when the source is not sequenceDiagram or yields no turns.
 *
 * Related:
 * - SequenceFlow.tsx
 * - DesktopAiChatMarkdown.mermaid.tsx (MermaidFenceBlock)
 */

export type SequenceTurn = {
	id: string;
	from: string;
	to: string;
	text: string;
	/** Solid vs reply/async — display hint only. */
	kind: 'solid' | 'dashed' | 'async';
};

export type ParsedSequence = {
	title: string;
	turns: SequenceTurn[];
};

function diagramBody(source: string): string {
	return source.replace(/^\s*mermaid\s*\r?\n/i, '').trim();
}

export function isMermaidSequenceSource(source: string): boolean {
	return /^sequenceDiagram\b/i.test(diagramBody(source));
}

function unescapeLabel(raw: string): string {
	return raw
		.replace(/\\n/g, ' ')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Best-effort Mermaid sequenceDiagram parser (LLM / Kursorina shapes).
 */
export function parseMermaidSequence(source: string): ParsedSequence | null {
	if (!isMermaidSequenceSource(source)) return null;
	const body = diagramBody(source);
	const lines = body.split(/\r?\n/);

	let title = '';
	const aliases = new Map<string, string>();
	const turns: SequenceTurn[] = [];

	const display = (id: string): string => aliases.get(id) ?? id;

	for (const lineRaw of lines) {
		const line = lineRaw.trim();
		if (!line) continue;
		if (/^sequenceDiagram\b/i.test(line)) continue;
		if (/^%%/.test(line)) continue;
		if (/^(activate|deactivate|autoresize|autonumber)\b/i.test(line)) continue;
		if (/^(loop|alt|else|opt|par|and|critical|break|rect|end)\b/i.test(line))
			continue;
		if (/^Note\b/i.test(line)) continue;

		const titleMatch = /^title\s+(.+)$/i.exec(line);
		if (titleMatch) {
			title = titleMatch[1].trim();
			continue;
		}

		const partAs = /^(?:participant|actor)\s+([^\s]+)\s+as\s+(.+)$/i.exec(line);
		if (partAs) {
			aliases.set(partAs[1], unescapeLabel(partAs[2]));
			continue;
		}
		const partBare = /^(?:participant|actor)\s+([^\s]+)$/i.exec(line);
		if (partBare) {
			if (!aliases.has(partBare[1])) aliases.set(partBare[1], partBare[1]);
			continue;
		}

		const msg =
			/^([A-Za-z_][\w]*)\s*(-->>|->>|--\)|-\)|-->|->)\s*([A-Za-z_][\w]*)\s*:\s*(.+)$/.exec(
				line
			);
		if (msg) {
			const arrow = msg[2];
			let kind: SequenceTurn['kind'] = 'solid';
			if (arrow.endsWith(')')) kind = 'async';
			else if (arrow.startsWith('--')) kind = 'dashed';
			turns.push({
				id: `t${turns.length + 1}`,
				from: display(msg[1]),
				to: display(msg[3]),
				text: unescapeLabel(msg[4]),
				kind,
			});
		}
	}

	if (turns.length === 0) return null;
	return { title, turns };
}
