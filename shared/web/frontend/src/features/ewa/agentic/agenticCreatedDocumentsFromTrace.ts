/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse HITL-created documents from agentic trace checkpoints (FE fallback when mirror lacks created_documents).
 *
 * Related:
 * - api/ewa_platform/agentic/adapters/task_run_mirror.py
 */

import type { AgenticCheckpointRow } from '@/features/ewa/agentic/agenticTraceApi';
import type { AgenticCreatedDocument } from '@/features/ewa/companionOperations/companionOperationsUi';

const GATE_DOC_NAME_RE = /«([^»]+)»/;

function documentNameFromGateSummary(summary: string): string {
	const match = GATE_DOC_NAME_RE.exec(summary);
	return match?.[1]?.trim() ?? '';
}

export function agenticCreatedDocumentsFromTrace(
	checkpoints: AgenticCheckpointRow[]
): AgenticCreatedDocument[] {
	const out: AgenticCreatedDocument[] = [];
	const seen = new Set<string>();
	for (const row of checkpoints) {
		const kind = (row.kind || '').trim();
		const payload = row.payload_json;
		if (!payload || typeof payload !== 'object') continue;

		let unifiedContentId = '';
		let name = '';

		if (kind === 'gate') {
			if (String(payload.event || '') !== 'hitl_companion_finalize') continue;
			if (String(payload.decision || '') !== 'confirm') continue;
			unifiedContentId = String(
				payload.created_unified_content_id || ''
			).trim();
			name = documentNameFromGateSummary(String(payload.summary || ''));
		} else if (kind === 'act') {
			const tool = String(payload.tool || payload.tool_name || '').trim();
			if (tool !== 'file_create' && tool !== 'file_save_text') continue;
			const status = String(payload.status || '')
				.trim()
				.toLowerCase();
			if (status !== 'ok' && status !== 'memory_append') continue;
			unifiedContentId = String(
				payload.created_unified_content_id || payload.unified_content_id || ''
			).trim();
			name =
				String(payload.document_name || '').trim() ||
				documentNameFromGateSummary(String(payload.summary || ''));
		} else {
			continue;
		}

		if (!unifiedContentId || seen.has(unifiedContentId)) continue;
		seen.add(unifiedContentId);
		out.push({
			unifiedContentId,
			name: name || unifiedContentId,
		});
	}
	return out;
}
