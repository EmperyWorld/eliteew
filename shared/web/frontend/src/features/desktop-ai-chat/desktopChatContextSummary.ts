/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Format SSE done.context summary line for Desktop AI Chat message footers.
 *
 * Invariants:
 * - Metadata-only; never embeds chunk bodies or untrusted retrieval text.
 * - Attachment count 0 is not «no context» when history / project / derived / memory exist.
 *
 * Related:
 * - DesktopAiChatApp.tsx
 * - api/desktopChatClient.ts (DesktopAiStreamContextSummary)
 */

import type { TFunction } from 'i18next';
import type { DesktopAiStreamContextSummary } from './api/desktopChatClient';
import { normalizeDesktopAiContextSources } from './desktopAiEvidence';

export type DesktopAiContextFootnote = {
	line: string;
	tooltip: string;
};

type PublicContextCounts = {
	chat: number;
	project: number;
	derived: number;
	web: number;
};

function publicContextCounts(
	c: DesktopAiStreamContextSummary
): PublicContextCounts {
	const sources = normalizeDesktopAiContextSources(c.context_sources);
	const countKind = (kind: (typeof sources)[number]['kind']) =>
		sources.filter((source) => source.kind === kind).length;
	const attachmentChunks = Math.max(
		0,
		c.chat_attachment_chunks ?? c.chat_rag_chunks ?? 0
	);
	return {
		chat:
			countKind('chat_attachment') ||
			Math.max(0, c.chat_rag_quality?.unique_content_ids ?? 0) ||
			attachmentChunks,
		project:
			countKind('project_document') ||
			Math.max(0, c.project_vault_quality?.unique_content_ids ?? 0) ||
			Math.max(0, c.project_vault_chunks ?? 0),
		derived: countKind('derived_ai_artifact'),
		web:
			countKind('web') ||
			(Array.isArray(c.web_search_sources) ? c.web_search_sources.length : 0),
	};
}

function knowledgeBaseFootnotePart(
	c: DesktopAiStreamContextSummary,
	t: TFunction<'desktopAiChat'>
): string | null {
	const status = c.kbsew_prefetch_status;
	if (!status || status === 'disabled') {
		return null;
	}
	const ok = Math.max(0, c.kbsew_prefetch_barrels_ok ?? 0);
	if (status === 'ok' || status === 'partial_stale') {
		if (ok <= 0 && !c.kbsew_prefetch_applied) {
			return null;
		}
		return t('contextKnowledgeMaterials', { count: Math.max(ok, 1) });
	}
	if (status === 'stale') {
		return t('contextKnowledgeRefreshing');
	}
	if (status === 'error') {
		return t('contextKnowledgeUnavailable');
	}
	if (status === 'empty') {
		return t('contextKnowledgeEmpty');
	}
	return null;
}

export function formatDesktopAiContextSummaryLine(
	c: DesktopAiStreamContextSummary | undefined,
	t: TFunction<'desktopAiChat'>
): string {
	if (!c) {
		return '';
	}
	const counts = publicContextCounts(c);
	const parts: string[] = [];
	if (counts.chat > 0)
		parts.push(t('contextChatMaterials', { count: counts.chat }));
	if (counts.project > 0)
		parts.push(t('contextProjectMaterials', { count: counts.project }));
	if (counts.derived > 0)
		parts.push(t('contextDerivedMaterials', { count: counts.derived }));
	if (counts.web > 0)
		parts.push(t('contextWebMaterials', { count: counts.web }));
	const kbPart = knowledgeBaseFootnotePart(c, t);
	if (kbPart) parts.push(kbPart);
	const memChunks = Math.max(0, c.memory_cell_chunks ?? 0);
	if (c.memory_cell_requested && memChunks > 0) {
		parts.push(t('contextMemoryCellMaterials', { count: memChunks }));
	}
	if (parts.length > 0) {
		return t('contextSummaryPrefix', { parts: parts.join('; ') });
	}
	// Empty citeable materials: do not imply «no context» when history / dialog memory / compact project support exist.
	const historyUsed = Math.max(0, c.history_messages_used ?? 0);
	const memoryHits = Math.max(0, c.chat_memory_hits ?? 0);
	if (historyUsed > 0 || memoryHits > 0) {
		const honesty: string[] = [];
		if (historyUsed > 0) {
			honesty.push(t('contextHistoryMessages', { count: historyUsed }));
		}
		if (memoryHits > 0) {
			honesty.push(t('contextDialogMemoryHits', { count: memoryHits }));
		}
		return t('contextSummaryPrefix', { parts: honesty.join('; ') });
	}
	if ((c.project_vault_chunks ?? 0) > 0 || counts.derived > 0) {
		return t('contextSupportCompact');
	}
	return '';
}

export function buildDesktopAiContextSummaryTooltip(
	c: DesktopAiStreamContextSummary | undefined,
	t: TFunction<'desktopAiChat'>
): string {
	if (!c) {
		return t('contextSummaryTooltip');
	}
	const rows: string[] = [t('contextSummaryTooltip')];
	const counts = publicContextCounts(c);
	if (counts.chat > 0)
		rows.push(t('contextTooltipChatMaterials', { count: counts.chat }));
	if (counts.project > 0)
		rows.push(t('contextTooltipProjectMaterials', { count: counts.project }));
	if (counts.derived > 0)
		rows.push(t('contextTooltipDerivedMaterials', { count: counts.derived }));
	if (counts.web > 0)
		rows.push(t('contextTooltipWebMaterials', { count: counts.web }));
	const historyUsed = Math.max(0, c.history_messages_used ?? 0);
	if (historyUsed > 0) {
		rows.push(t('contextTooltipHistoryMessages', { count: historyUsed }));
	}
	const memoryHits = Math.max(0, c.chat_memory_hits ?? 0);
	if (memoryHits > 0) {
		rows.push(t('contextTooltipDialogMemory', { count: memoryHits }));
	}
	const kbPart = knowledgeBaseFootnotePart(c, t);
	if (kbPart) {
		rows.push(t('contextTooltipKnowledge', { detail: kbPart }));
	}
	return rows.join('\n');
}

export function buildDesktopAiContextFootnote(
	c: DesktopAiStreamContextSummary | undefined,
	t: TFunction<'desktopAiChat'>
): DesktopAiContextFootnote | null {
	const line = formatDesktopAiContextSummaryLine(c, t);
	if (!line) {
		return null;
	}
	return {
		line,
		tooltip: buildDesktopAiContextSummaryTooltip(c, t),
	};
}
