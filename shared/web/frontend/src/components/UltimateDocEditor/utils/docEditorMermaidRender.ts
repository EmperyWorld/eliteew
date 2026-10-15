/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render Mermaid to SVG for document insert (as an image). Local initialize —
 * does not import the chat markdown module.
 *
 * Invariants:
 * - mermaid.initialize runs before every render (singleton shared with chat).
 * - Root htmlLabels false so data:image/svg+xml has no foreignObject.
 *
 * Related:
 * - features/diagrams/mermaidProductLayout.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import type { MermaidConfig } from 'mermaid';
import {
	MERMAID_DOC_EDITOR_HTML_LABELS,
	MERMAID_V12_PRODUCT_LAYOUT,
	mermaidV12FlowchartBlock,
	withMermaidExclusive,
} from '@/features/diagrams/mermaidProductLayout';

export function docEditorMermaidInitializeConfig(): MermaidConfig {
	return {
		startOnLoad: false,
		theme: 'dark',
		htmlLabels: MERMAID_DOC_EDITOR_HTML_LABELS,
		...MERMAID_V12_PRODUCT_LAYOUT,
		securityLevel: 'strict',
		fontFamily: 'ui-sans-serif, system-ui, sans-serif',
		flowchart: mermaidV12FlowchartBlock(MERMAID_DOC_EDITOR_HTML_LABELS),
	};
}

export async function renderMermaidDiagramToSvg(
	source: string
): Promise<string> {
	const trimmed = source.trim();
	if (!trimmed) {
		throw new Error('Пустой код диаграммы');
	}
	const mermaid = (await import('mermaid')).default;
	return withMermaidExclusive(async () => {
		mermaid.initialize(docEditorMermaidInitializeConfig());
		const renderId = `doc-mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
		try {
			const { svg } = await mermaid.render(renderId, trimmed);
			for (const cid of [renderId, `d${renderId}`]) {
				const el = document.getElementById(cid);
				if (el) {
					try {
						el.remove();
					} catch {
						/* ignore */
					}
				}
			}
			if (!svg || !/<svg[\s>]/i.test(svg.trim())) {
				throw new Error('Mermaid не вернул SVG');
			}
			const low = svg.toLowerCase();
			if (
				low.includes('syntax error') ||
				low.includes('parse error') ||
				low.includes('aria-roledescription="error"')
			) {
				throw new Error('Ошибка синтаксиса Mermaid');
			}
			return svg;
		} catch (e) {
			for (const cid of [renderId, `d${renderId}`]) {
				document.getElementById(cid)?.remove();
			}
			throw e;
		}
	});
}
