/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse Mermaid flowchart/graph fence text into ordered process steps for
 * editorial ProcessFlow UI (not Mermaid SVG).
 *
 * Invariants:
 * - Pure / deterministic; no Mermaid library.
 * - Returns null when the source is not flowchart/graph or yields no nodes.
 *
 * Related:
 * - ProcessFlow.tsx
 * - DesktopAiChatMarkdown.mermaid.tsx (MermaidFenceBlock)
 * - shared/api/services/kursorina/tools.py (generate_diagram)
 */

export type FlowStep = {
	id: string;
	label: string;
	/** Parent node ids (incoming edges). */
	from: string[];
	/** Optional edge label from the first incoming edge that carries text. */
	via: string;
};

export type ParsedFlowchart = {
	title: string;
	direction: 'TD' | 'LR' | 'TB' | 'BT' | 'RL';
	steps: FlowStep[];
};

const HEADER_RE = /^(?:flowchart|graph)\s+(TD|LR|TB|BT|RL)\b/i;
const HEADER_BARE_RE = /^(?:flowchart|graph)\b/i;

/** Strip optional leading `mermaid` info-line residue. */
function diagramBody(source: string): string {
	return source.replace(/^\s*mermaid\s*\r?\n/i, '').trim();
}

export function isMermaidFlowchartSource(source: string): boolean {
	const t = diagramBody(source);
	return HEADER_BARE_RE.test(t);
}

function unescapeLabel(raw: string): string {
	return raw
		.replace(/\\n/g, ' ')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Extract node id + display label from a Mermaid node token.
 * Supports A, A[text], A(text), A{text}, A((text)), A>"text"], A(["text"]).
 */
function parseNodeToken(token: string): { id: string; label: string } | null {
	const t = token.trim();
	if (!t) return null;

	const shaped =
		/^([A-Za-z_][\w]*)\s*(?:\[\(?([^\])]*)\)?\]|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\(\(([^)]*)\)\)|>([^\]]*)\]|\(\[([^\]]*)\]\))$/.exec(
			t
		);
	if (shaped) {
		const id = shaped[1];
		const label = unescapeLabel(
			shaped[2] ??
				shaped[3] ??
				shaped[4] ??
				shaped[5] ??
				shaped[6] ??
				shaped[7] ??
				shaped[8] ??
				id
		);
		return { id, label: label || id };
	}

	const bare = /^([A-Za-z_][\w]*)$/.exec(t);
	if (bare) return { id: bare[1], label: bare[1] };
	return null;
}

type EdgeHit = {
	fromId: string;
	fromLabel: string;
	toId: string;
	toLabel: string;
	via: string;
};

/**
 * Parse one edge line: `A[Label] -->|via| B[Other]` / `A --> B` / `A --- B`.
 */
function parseEdgeLine(line: string): EdgeHit | null {
	const arrow =
		/^(.+?)\s*(<-->|-->|---|-\.-|-\.->|==>|==|--x|o--)\s*(?:\|([^|]*)\|\s*)?(.+)$/.exec(
			line
		);
	if (!arrow) return null;
	const left = parseNodeToken(arrow[1]);
	const right = parseNodeToken(arrow[4]);
	if (!left || !right) return null;
	return {
		fromId: left.id,
		fromLabel: left.label,
		toId: right.id,
		toLabel: right.label,
		via: unescapeLabel(arrow[3] ?? ''),
	};
}

function parseStandaloneNode(
	line: string
): { id: string; label: string } | null {
	if (/-->|---|-\.-|==>|==|--x|o--/.test(line)) return null;
	return parseNodeToken(line);
}

function topologicalSteps(
	labels: Map<string, string>,
	incoming: Map<string, { from: string; via: string }[]>,
	outgoing: Map<string, string[]>
): FlowStep[] {
	const ids = [...labels.keys()];
	const indeg = new Map<string, number>();
	for (const id of ids) indeg.set(id, (incoming.get(id) ?? []).length);

	const queue = ids
		.filter((id) => (indeg.get(id) ?? 0) === 0)
		.sort((a, b) => a.localeCompare(b));
	const ordered: string[] = [];
	const seen = new Set<string>();

	while (queue.length) {
		const id = queue.shift();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ordered.push(id);
		for (const nxt of outgoing.get(id) ?? []) {
			const next = (indeg.get(nxt) ?? 0) - 1;
			indeg.set(nxt, next);
			if (next <= 0 && !seen.has(nxt)) queue.push(nxt);
		}
		queue.sort((a, b) => a.localeCompare(b));
	}

	for (const id of ids) {
		if (!seen.has(id)) ordered.push(id);
	}

	return ordered.map((id) => {
		const parents = incoming.get(id) ?? [];
		const via = parents.map((p) => p.via).find((v) => v.length > 0) ?? '';
		return {
			id,
			label: labels.get(id) ?? id,
			from: parents.map((p) => p.from),
			via,
		};
	});
}

/**
 * Best-effort Mermaid flowchart/graph parser (Kursorina / LLM shapes).
 */
export function parseMermaidFlowchart(source: string): ParsedFlowchart | null {
	if (!isMermaidFlowchartSource(source)) return null;
	const body = diagramBody(source);
	const lines = body.split(/\r?\n/);

	let title = '';
	let direction: ParsedFlowchart['direction'] = 'TD';
	const labels = new Map<string, string>();
	const incoming = new Map<string, { from: string; via: string }[]>();
	const outgoing = new Map<string, string[]>();

	const rememberNode = (id: string, label: string) => {
		const prev = labels.get(id);
		if (!prev || prev === id) labels.set(id, label || id);
	};

	const addEdge = (hit: EdgeHit) => {
		rememberNode(hit.fromId, hit.fromLabel);
		rememberNode(hit.toId, hit.toLabel);
		const ins = incoming.get(hit.toId) ?? [];
		if (!ins.some((p) => p.from === hit.fromId)) {
			ins.push({ from: hit.fromId, via: hit.via });
			incoming.set(hit.toId, ins);
		}
		const outs = outgoing.get(hit.fromId) ?? [];
		if (!outs.includes(hit.toId)) {
			outs.push(hit.toId);
			outgoing.set(hit.fromId, outs);
		}
	};

	for (const lineRaw of lines) {
		const line = lineRaw.trim();
		if (!line) continue;

		const headerDir = HEADER_RE.exec(line);
		if (headerDir) {
			direction = headerDir[1].toUpperCase() as ParsedFlowchart['direction'];
			continue;
		}
		if (HEADER_BARE_RE.test(line)) continue;

		if (/^%%/.test(line)) continue;
		if (/^(classDef|class|style|linkStyle|click|direction)\b/i.test(line))
			continue;
		if (/^subgraph\b/i.test(line)) continue;
		if (/^end\b/i.test(line)) continue;

		const titleMatch = /^title\s+(.+)$/i.exec(line);
		if (titleMatch) {
			title = titleMatch[1].trim();
			continue;
		}

		const edge = parseEdgeLine(line);
		if (edge) {
			addEdge(edge);
			continue;
		}

		const node = parseStandaloneNode(line);
		if (node) rememberNode(node.id, node.label);
	}

	if (labels.size === 0) return null;

	const steps = topologicalSteps(labels, incoming, outgoing);
	if (steps.length === 0) return null;

	return { title, direction, steps };
}
