/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Golden lock for public context footnote copy from shared API fixture.
 *
 * Invariants:
 * - User-facing line uses material families, not RAG/vault/score diagnostics.
 *
 * Related:
 * - api/tests/fixtures/desktop_chat_context_footnote_golden.json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { DesktopAiStreamContextSummary } from '../api/desktopChatClient';
import { splitContextTooltipDetailLines } from '../components/DesktopAiContextFootnote';
import { buildDesktopAiContextFootnote } from '../desktopChatContextSummary';

const GOLDEN_PATH = resolve(
	__dirname,
	'../../../../../../api/tests/fixtures/desktop_chat_context_footnote_golden.json'
);

const t = ((key: string, opts?: Record<string, unknown>) => {
	switch (key) {
		case 'contextChatMaterials':
			return `chat:${opts?.count ?? 0}`;
		case 'contextProjectMaterials':
			return `project:${opts?.count ?? 0}`;
		case 'contextDerivedMaterials':
			return `derived:${opts?.count ?? 0}`;
		case 'contextWebMaterials':
			return `web:${opts?.count ?? 0}`;
		case 'contextNoSupportingMaterials':
			return 'none';
		case 'contextSummaryPrefix':
			return `CTX(${opts?.parts ?? ''})`;
		case 'contextSummaryTooltip':
			return 'TOOLTIP:base';
		case 'contextTooltipChatMaterials':
			return `TIP:chat:${opts?.count ?? 0}`;
		case 'contextTooltipProjectMaterials':
			return `TIP:project:${opts?.count ?? 0}`;
		case 'contextTooltipDerivedMaterials':
			return `TIP:derived:${opts?.count ?? 0}`;
		case 'contextTooltipWebMaterials':
			return `TIP:web:${opts?.count ?? 0}`;
		default:
			return key;
	}
}) as TFunction<'desktopAiChat'>;

describe('desktop chat context footnote golden contract', () => {
	it('loads shared rich footnote fixture from api/tests/fixtures', () => {
		const golden = JSON.parse(
			readFileSync(GOLDEN_PATH, 'utf-8')
		) as DesktopAiStreamContextSummary;
		expect(golden.project_vault_requested).toBe(true);
		expect(golden.context_sources?.length).toBe(5);
		expect(golden.chat_rag_quality?.score_avg).toBeCloseTo(0.856);
	});

	it('builds expandable footnote with public material rows from golden', () => {
		const golden = JSON.parse(
			readFileSync(GOLDEN_PATH, 'utf-8')
		) as DesktopAiStreamContextSummary;
		const footnote = buildDesktopAiContextFootnote(golden, t);
		expect(footnote).not.toBeNull();
		expect(footnote?.line).toContain('chat:2');
		expect(footnote?.line).toContain('project:3');
		expect(footnote?.line).not.toMatch(/rag|vault|score/i);
		const detailLines = splitContextTooltipDetailLines(
			footnote?.tooltip ?? '',
			footnote?.line
		);
		expect(detailLines).toContain('TIP:chat:2');
		expect(detailLines).toContain('TIP:project:3');
		expect(detailLines.length).toBeGreaterThanOrEqual(2);
	});
});
