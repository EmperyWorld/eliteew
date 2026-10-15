/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse server `surface_blocks[].payload` for kind-specific UI bodies (U4.10–U4.13).
 *
 * Invariants:
 * - Parsers are tolerant; unknown/malformed payload yields null (no render).
 * - No side effects; handlers live in React components.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionSurfaceBlockBody.tsx
 * - api/ewa_platform/schemas/pydantic/companion_chat.py
 */

import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';
import type { CompanionSurfaceBlock } from '@/services/ewa/ewaCompanionChatApi';

export type CompanionSurfaceBlockChoice = {
	id: string;
	label: string;
	prompt: string;
};

export type CompanionSurfaceBlockBuilderRef = {
	workflowId?: string;
	duplicateFromId?: string;
	seedTriggerPhrase?: string;
};

export type CompanionSurfaceBlockHistoryRef = {
	runId: string;
	label: string;
};

export type CompanionSurfaceBlockStepsSummary = {
	total: number;
	completed: number;
};

function asRecord(raw: unknown): Record<string, unknown> {
	return raw && typeof raw === 'object' && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: {};
}

function localizedField(
	payload: Record<string, unknown>,
	ru: boolean,
	keys: [string, string]
): string {
	const [ruKey, enKey] = keys;
	const primary = String(payload[ru ? ruKey : enKey] ?? '').trim();
	if (primary) return primary;
	return String(payload[ru ? enKey : ruKey] ?? '').trim();
}

export function parseCompanionSurfaceBlockText(
	block: CompanionSurfaceBlock,
	ru: boolean
): string | null {
	const text = localizedField(block.payload, ru, ['text_ru', 'text_en']);
	if (text) return text;
	const fallback = String(
		block.payload.text ?? block.payload.body ?? ''
	).trim();
	return fallback || null;
}

export function parseCompanionSurfaceBlockChoices(
	block: CompanionSurfaceBlock,
	ru: boolean
): CompanionSurfaceBlockChoice[] {
	const raw = block.payload.choices;
	if (!Array.isArray(raw)) return [];
	return raw
		.map((row, index) => {
			const rec = asRecord(row);
			const label = localizedField(rec, ru, ['label_ru', 'label_en']);
			const prompt = String(rec.prompt ?? rec.value ?? label).trim();
			const id = String(rec.id ?? `choice-${index}`).trim();
			if (!label || !prompt) return null;
			return { id, label, prompt };
		})
		.filter((row): row is CompanionSurfaceBlockChoice => row !== null);
}

export function parseCompanionSurfaceBlockBuilderRef(
	block: CompanionSurfaceBlock
): CompanionSurfaceBlockBuilderRef | null {
	const payload = block.payload;
	const workflowId = String(
		payload.workflow_id ?? payload.workflowId ?? ''
	).trim();
	const duplicateFromId = String(
		payload.duplicate_from_id ?? payload.duplicateFromId ?? ''
	).trim();
	const seedTriggerPhrase = String(
		payload.seed_trigger_phrase ?? payload.seedTriggerPhrase ?? ''
	).trim();
	if (!workflowId && !duplicateFromId && !seedTriggerPhrase) return null;
	return {
		...(workflowId ? { workflowId } : {}),
		...(duplicateFromId ? { duplicateFromId } : {}),
		...(seedTriggerPhrase ? { seedTriggerPhrase } : {}),
	};
}

export function companionSurfaceBlockBuilderSurface(
	ref: CompanionSurfaceBlockBuilderRef
): CompanionOutputSurfaceState {
	return {
		mode: 'workflow_dag_builder',
		payload: {
			...(ref.workflowId ? { workflowId: ref.workflowId } : {}),
			...(ref.duplicateFromId ? { duplicateFromId: ref.duplicateFromId } : {}),
			...(ref.seedTriggerPhrase
				? { seedTriggerPhrase: ref.seedTriggerPhrase }
				: {}),
		},
	};
}

export function parseCompanionSurfaceBlockHistoryRef(
	block: CompanionSurfaceBlock,
	ru: boolean
): CompanionSurfaceBlockHistoryRef | null {
	const payload = block.payload;
	const runId = String(
		payload.ref_run_id ??
			payload.reference_run_id ??
			payload.history_run_id ??
			payload.run_id ??
			''
	).trim();
	if (!runId) return null;
	const label =
		localizedField(payload, ru, ['label_ru', 'label_en']) ||
		String(payload.title ?? block.title ?? runId).trim();
	return { runId, label: label || runId };
}

export function parseCompanionSurfaceBlockStepsSummary(
	block: CompanionSurfaceBlock
): CompanionSurfaceBlockStepsSummary | null {
	const raw = block.payload.steps;
	if (!Array.isArray(raw) || raw.length === 0) return null;
	let completed = 0;
	for (const row of raw) {
		const status = String(asRecord(row).status ?? '')
			.trim()
			.toLowerCase();
		if (status === 'completed' || status === 'done' || status === 'success') {
			completed += 1;
		}
	}
	return { total: raw.length, completed };
}

export function parseCompanionSurfaceBlockResultHint(
	block: CompanionSurfaceBlock,
	ru: boolean
): string | null {
	const status = String(block.status ?? '')
		.trim()
		.toLowerCase();
	const errorPayload = asRecord(block.payload.error_payload);
	const message = String(
		errorPayload.message ?? errorPayload.detail ?? ''
	).trim();
	if (status === 'failed' && message) return message;
	const resultPayload = asRecord(block.payload.result_payload);
	const hint = localizedField(resultPayload, ru, ['summary_ru', 'summary_en']);
	return hint || null;
}

export function companionSurfaceBlockBodyVisible(
	block: CompanionSurfaceBlock,
	ru: boolean
): boolean {
	switch (block.kind) {
		case 'text':
			return Boolean(parseCompanionSurfaceBlockText(block, ru));
		case 'choice':
			return parseCompanionSurfaceBlockChoices(block, ru).length > 0;
		case 'builder':
			return Boolean(parseCompanionSurfaceBlockBuilderRef(block));
		case 'history_ref':
			return Boolean(parseCompanionSurfaceBlockHistoryRef(block, ru));
		case 'workflow_timeline':
			return Boolean(parseCompanionSurfaceBlockStepsSummary(block));
		case 'result':
			return Boolean(parseCompanionSurfaceBlockResultHint(block, ru));
		default:
			return false;
	}
}
