/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock user-facing context footnote copy against public evidence counts (no RAG/vault/score diagnostics).
 *
 * Invariants:
 * - Footnotes stay metadata-only and never invent chunk scores or storage ids.
 *
 * Related:
 * - src/features/desktop-ai-chat/desktopChatContextSummary.ts
 */
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { DesktopAiStreamContextSummary } from '../api/desktopChatClient';
import {
	buildDesktopAiContextFootnote,
	buildDesktopAiContextSummaryTooltip,
	formatDesktopAiContextSummaryLine,
} from '../desktopChatContextSummary';

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
		case 'contextHistoryMessages':
			return `history:${opts?.count ?? 0}`;
		case 'contextDialogMemoryHits':
			return `memory:${opts?.count ?? 0}`;
		case 'contextSupportCompact':
			return 'compact-support';
		case 'contextKnowledgeMaterials':
			return `kb:${opts?.count ?? 0}`;
		case 'contextKnowledgeRefreshing':
			return 'kb:refreshing';
		case 'contextKnowledgeUnavailable':
			return 'kb:unavailable';
		case 'contextKnowledgeEmpty':
			return 'kb:empty';
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
		case 'contextTooltipHistoryMessages':
			return `TIP:history:${opts?.count ?? 0}`;
		case 'contextTooltipDialogMemory':
			return `TIP:memory:${opts?.count ?? 0}`;
		case 'contextTooltipKnowledge':
			return `TIP:kb:${opts?.detail ?? ''}`;
		default:
			return key;
	}
}) as TFunction<'desktopAiChat'>;

describe('formatDesktopAiContextSummaryLine', () => {
	it('returns empty string when context is missing', () => {
		expect(formatDesktopAiContextSummaryLine(undefined, t)).toBe('');
	});

	it('returns empty when no public materials and retrieval was not requested', () => {
		// Legacy shape without honesty aliases / sources — still empty chrome.
		expect(
			formatDesktopAiContextSummaryLine(
				{ chat_rag_requested: 0, chat_rag_chunks: 0, history_messages_used: 0 },
				t
			)
		).toBe('');
	});

	it('shows attachment count from chat_attachment_chunks honesty alias', () => {
		expect(
			formatDesktopAiContextSummaryLine(
				{ chat_attachment_chunks: 3, chat_rag_chunks: 3 },
				t
			)
		).toBe('CTX(chat:3)');
	});

	it('returns empty when retrieval found nothing usable (no empty-state chrome)', () => {
		expect(
			formatDesktopAiContextSummaryLine(
				{
					chat_rag_requested: 4,
					chat_rag_chunks: 0,
					chat_attachment_chunks: 0,
				},
				t
			)
		).toBe('');
		expect(
			buildDesktopAiContextFootnote(
				{
					chat_rag_requested: 4,
					chat_rag_chunks: 0,
					chat_attachment_chunks: 0,
				},
				t
			)
		).toBeNull();
	});

	it('does not treat attachment 0 as no-context when history was used', () => {
		expect(
			formatDesktopAiContextSummaryLine(
				{
					chat_rag_requested: 4,
					chat_rag_chunks: 0,
					chat_attachment_chunks: 0,
					history_messages_used: 12,
				},
				t
			)
		).toBe('CTX(history:12)');
	});

	it('shows dialog memory hits when attachments are empty', () => {
		expect(
			formatDesktopAiContextSummaryLine(
				{
					chat_attachment_chunks: 0,
					chat_memory_hits: 4,
					history_messages_used: 0,
				},
				t
			)
		).toBe('CTX(memory:4)');
	});

	it('shows knowledge-base refresh state in the footnote', () => {
		expect(
			formatDesktopAiContextSummaryLine(
				{
					kbsew_prefetch_status: 'stale',
					kbsew_prefetch_applied: true,
					kbsew_prefetch_barrels_stale: 1,
				},
				t
			)
		).toBe('CTX(kb:refreshing)');
	});

	it('prefers public context_sources over raw chunk counters', () => {
		const ctx: DesktopAiStreamContextSummary = {
			chat_rag_chunks: 9,
			project_vault_requested: true,
			project_vault_chunks: 9,
			context_sources: [
				{
					citation_id: 'C1',
					kind: 'chat_attachment',
					authority: 'user_material',
					title: 'Brief notes',
				},
				{
					citation_id: 'P1',
					kind: 'project_document',
					authority: 'project_material',
					title: 'Research',
				},
				{
					citation_id: 'D1',
					kind: 'derived_ai_artifact',
					authority: 'derived',
					title: 'Earlier AI brief',
				},
			],
		};
		expect(formatDesktopAiContextSummaryLine(ctx, t)).toBe(
			'CTX(chat:1; project:1; derived:1)'
		);
	});

	it('falls back to unique content counts when context_sources is absent', () => {
		const ctx: DesktopAiStreamContextSummary = {
			chat_rag_quality: { unique_content_ids: 2 },
			project_vault_requested: true,
			project_vault_quality: { unique_content_ids: 3 },
			web_search_sources: [{ url: 'https://a.test', title: 'A' }],
		};
		expect(formatDesktopAiContextSummaryLine(ctx, t)).toBe(
			'CTX(chat:2; project:3; web:1)'
		);
	});
});

describe('buildDesktopAiContextSummaryTooltip', () => {
	it('lists public material families without score diagnostics', () => {
		const tip = buildDesktopAiContextSummaryTooltip(
			{
				context_sources: [
					{
						citation_id: 'P1',
						kind: 'project_document',
						authority: 'project_material',
						title: 'Research',
					},
					{
						citation_id: 'D1',
						kind: 'derived_ai_artifact',
						authority: 'derived',
						title: 'Earlier AI brief',
					},
				],
			},
			t
		);
		expect(tip).toContain('TOOLTIP:base');
		expect(tip).toContain('TIP:project:1');
		expect(tip).toContain('TIP:derived:1');
		expect(tip).not.toMatch(/score|vault|rag/i);
	});
});

describe('buildDesktopAiContextFootnote', () => {
	it('returns null when there is nothing user-visible to say', () => {
		expect(buildDesktopAiContextFootnote({ chat_rag_chunks: 0 }, t)).toBeNull();
	});

	it('returns line + tooltip for public materials', () => {
		const footnote = buildDesktopAiContextFootnote(
			{
				context_sources: [
					{
						citation_id: 'C1',
						kind: 'chat_attachment',
						authority: 'user_material',
						title: 'Notes',
					},
				],
			},
			t
		);
		expect(footnote).toEqual({
			line: 'CTX(chat:1)',
			tooltip: 'TOOLTIP:base\nTIP:chat:1',
		});
	});
});
