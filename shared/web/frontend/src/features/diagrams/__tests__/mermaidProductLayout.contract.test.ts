/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Mermaid 12 product knobs: dagre/classic, root htmlLabels split chat vs Doc Editor.
 *
 * Invariants:
 * - Nested flowchart look/layout match root.
 * - Doc Editor htmlLabels is false at root (img SVG, no foreignObject).
 *
 * Related:
 * - mermaidProductLayout.ts
 * - docEditorMermaidRender.ts
 */
import { describe, expect, it } from 'vitest';

import { docEditorMermaidInitializeConfig } from '@/components/UltimateDocEditor/utils/docEditorMermaidRender';
import {
	MERMAID_CHAT_HTML_LABELS,
	MERMAID_DOC_EDITOR_HTML_LABELS,
	MERMAID_V12_PRODUCT_LAYOUT,
	mermaidV12FlowchartBlock,
	withMermaidExclusive,
} from '@/features/diagrams/mermaidProductLayout';

describe('mermaidProductLayout (Mermaid 12)', () => {
	it('pins dagre + classic (not ELK/neo defaults)', () => {
		expect(MERMAID_V12_PRODUCT_LAYOUT).toEqual({
			look: 'classic',
			layout: 'dagre',
		});
	});

	it('copies look/layout onto flowchart blocks', () => {
		const chat = mermaidV12FlowchartBlock(MERMAID_CHAT_HTML_LABELS);
		const doc = mermaidV12FlowchartBlock(MERMAID_DOC_EDITOR_HTML_LABELS);
		expect(chat.look).toBe('classic');
		expect(chat.layout).toBe('dagre');
		expect(chat.htmlLabels).toBe(true);
		expect(doc.htmlLabels).toBe(false);
		expect(doc.layout).toBe('dagre');
	});

	it('Doc Editor initialize uses root htmlLabels false', () => {
		const cfg = docEditorMermaidInitializeConfig();
		expect(cfg.htmlLabels).toBe(false);
		expect(cfg.look).toBe('classic');
		expect(cfg.layout).toBe('dagre');
		expect(cfg.flowchart?.htmlLabels).toBe(false);
		expect(cfg.flowchart?.layout).toBe('dagre');
		expect(cfg.flowchart?.look).toBe('classic');
	});

	it('withMermaidExclusive does not interleave callbacks', async () => {
		const order: number[] = [];
		await Promise.all([
			withMermaidExclusive(async () => {
				order.push(1);
				await Promise.resolve();
				order.push(2);
			}),
			withMermaidExclusive(async () => {
				order.push(3);
				order.push(4);
			}),
		]);
		expect(order).toEqual([1, 2, 3, 4]);
	});
});
