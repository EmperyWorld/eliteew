/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Mermaid 12 product knobs. Chat markdown and Doc Editor must not
 * each invent look/layout/htmlLabels; mermaid.initialize is a process singleton.
 *
 * Invariants:
 * - layout dagre + look classic — Mermaid 12 defaults to ELK + neo.
 * - htmlLabels is root-level (diagram-specific htmlLabels is ignored).
 *
 * Related:
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md
 */

export const MERMAID_V12_PRODUCT_LAYOUT = {
	look: 'classic',
	layout: 'dagre',
} as const;

export type MermaidV12ProductLayout = typeof MERMAID_V12_PRODUCT_LAYOUT;

/** Chat bubble / document fence: HTML labels OK (not embedded as <img>). */
export const MERMAID_CHAT_HTML_LABELS = true;

/** Doc Editor inserts SVG into <img src="data:image/svg+xml"> — no foreignObject. */
export const MERMAID_DOC_EDITOR_HTML_LABELS = false;

export function mermaidV12FlowchartBlock(htmlLabels: boolean): {
	useMaxWidth: boolean;
	htmlLabels: boolean;
	padding: number;
	look: 'classic';
	layout: 'dagre';
} {
	return {
		useMaxWidth: false,
		htmlLabels,
		padding: htmlLabels ? 16 : 12,
		...MERMAID_V12_PRODUCT_LAYOUT,
	};
}

/**
 * mermaid.initialize + render share one process singleton. Queue so chat
 * (htmlLabels true) and Doc Editor (htmlLabels false) cannot interleave.
 */
let mermaidExclusiveChain: Promise<void> = Promise.resolve();

export function withMermaidExclusive<T>(fn: () => Promise<T>): Promise<T> {
	const run = mermaidExclusiveChain.then(fn, fn);
	mermaidExclusiveChain = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}
