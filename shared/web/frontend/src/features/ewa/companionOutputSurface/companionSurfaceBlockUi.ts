/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for server-shaped companion surface blocks (U4.9) — labels and action routing.
 *
 * Invariants:
 * - Blocks are view descriptors only; confirm/cancel still use task-run APIs.
 * - `task_run_confirm` actions are hidden when the run card already shows ConfirmBar.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - src/features/ewa/companionOutputSurface/CompanionSurfaceBlockStrip.tsx
 */

import type { TFunction } from 'i18next';

import {
	normalizeCompanionOperationStatus,
	operationStatusLabel,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type {
	CompanionSurfaceBlock,
	CompanionSurfaceBlockAction,
	CompanionSurfaceBlockKind,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';

export function primaryCompanionSurfaceBlock(
	run: EwaCompanionTaskRun
): CompanionSurfaceBlock | null {
	const blocks = run.surface_blocks;
	if (!Array.isArray(blocks) || blocks.length === 0) return null;
	const first = blocks[0];
	return first?.id?.trim() ? first : null;
}

export function companionSurfaceBlockKindI18nKey(
	kind: CompanionSurfaceBlockKind
):
	| 'ewaCompanion.surfaceBlockKindResult'
	| 'ewaCompanion.surfaceBlockKindWorkflowTimeline'
	| 'ewaCompanion.surfaceBlockKindConfirm'
	| 'ewaCompanion.surfaceBlockKindChoice'
	| 'ewaCompanion.surfaceBlockKindBuilder'
	| 'ewaCompanion.surfaceBlockKindHistoryRef'
	| 'ewaCompanion.surfaceBlockKindText' {
	switch (kind) {
		case 'result':
			return 'ewaCompanion.surfaceBlockKindResult';
		case 'workflow_timeline':
			return 'ewaCompanion.surfaceBlockKindWorkflowTimeline';
		case 'confirm':
			return 'ewaCompanion.surfaceBlockKindConfirm';
		case 'choice':
			return 'ewaCompanion.surfaceBlockKindChoice';
		case 'builder':
			return 'ewaCompanion.surfaceBlockKindBuilder';
		case 'history_ref':
			return 'ewaCompanion.surfaceBlockKindHistoryRef';
		default:
			return 'ewaCompanion.surfaceBlockKindText';
	}
}

export function companionSurfaceBlockActionLabel(
	action: CompanionSurfaceBlockAction,
	ru: boolean
): string {
	const custom = (ru ? action.label_ru : action.label_en)?.trim();
	if (custom) return custom;
	return action.type.trim() || 'action';
}

export function companionSurfaceBlockCardTitle(
	run: EwaCompanionTaskRun,
	fallbackLabel: string
): string {
	const block = primaryCompanionSurfaceBlock(run);
	const title = block?.title?.trim();
	return title || fallbackLabel;
}

export function companionSurfaceBlockStatusLabel(
	block: CompanionSurfaceBlock,
	t: TFunction<'marketing'>
): string | null {
	const status = (block.status || '').trim();
	if (!status) return null;
	return operationStatusLabel(normalizeCompanionOperationStatus(status), t);
}

export function filterCompanionSurfaceBlockActions(
	block: CompanionSurfaceBlock,
	runStatus: string
): CompanionSurfaceBlockAction[] {
	const st = normalizeCompanionOperationStatus(runStatus);
	const hideConfirm = st === 'awaiting_confirmation';
	return block.actions.filter((action) => {
		const type = action.type.trim();
		if (hideConfirm && type === 'task_run_confirm') return false;
		return Boolean(type);
	});
}

export function companionSurfaceBlockDiscussPrompt(
	action: CompanionSurfaceBlockAction,
	run: EwaCompanionTaskRun,
	t: TFunction<'marketing'>
): string | null {
	if (action.type.trim() !== 'chat_follow_up') return null;
	const label =
		run.user_message?.trim() || run.intent_kind?.trim() || run.id.trim();
	if (!label) return null;
	return t('ewaCompanion.surfaceDiscussPrompt', {
		runId: run.id,
		label,
	});
}

export type CompanionSurfaceBlockActionHandlers = {
	onConfirmRun: (runId: string, decision: 'confirm' | 'cancel') => void;
	onDraftPlayPrompt: (text: string) => void;
};

export function dispatchCompanionSurfaceBlockAction(
	action: CompanionSurfaceBlockAction,
	run: EwaCompanionTaskRun,
	handlers: CompanionSurfaceBlockActionHandlers,
	t: TFunction<'marketing'>
): boolean {
	const type = action.type.trim();
	if (type === 'task_run_confirm') {
		const runId =
			typeof action.payload?.run_id === 'string'
				? action.payload.run_id.trim()
				: run.id.trim();
		const decision =
			action.payload?.decision === 'cancel' ? 'cancel' : 'confirm';
		if (!runId) return false;
		handlers.onConfirmRun(runId, decision);
		return true;
	}
	if (type === 'chat_follow_up') {
		const prompt = companionSurfaceBlockDiscussPrompt(action, run, t);
		if (!prompt) return false;
		handlers.onDraftPlayPrompt(prompt);
		return true;
	}
	return false;
}
