/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing labels and actions for companion turn-plan strip (no raw tool/source ids).
 *
 * Invariants:
 * - Pure helpers; i18n via ``TFunction``.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTurnPlanStrip.tsx
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 */

import type { TFunction } from 'i18next';

import { companionToolIdLabel } from '@/features/ewa/companionOperations/companionOperationsUi';

const MUSIC_TOOLS = new Set(['music_generation', 'music_generation_xl_base']);

/** Strip orchestrator vocabulary from server hints shown in the strip. */
export function sanitizeTurnPlanHint(raw: string): string {
	let text = (raw || '').trim();
	if (!text) return '';
	text = text.replace(/`[^`]+`/g, (m) => m.slice(1, -1));
	text = text.replace(
		/\b(?:run_id|task_id|Active_task_runs|check_task_status)\b/gi,
		''
	);
	text = text.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9_]+)+\b/gi, '');
	text = text.replace(/\bvia\b/gi, '');
	text = text.replace(/\bUUID\b/gi, '');
	text = text.replace(/\s{2,}/g, ' ').trim();
	return text;
}

export function resolveTurnPlanToolLabel(
	t: TFunction<'marketing'>,
	tool: string | null | undefined
): string {
	return companionToolIdLabel(t, tool);
}

export function turnPlanContinuePhrase(
	ru: boolean,
	tool: string | null | undefined
): string {
	const id = (tool || '').trim();
	if (MUSIC_TOOLS.has(id)) {
		return ru ? 'запускай' : 'go on';
	}
	return ru ? 'продолжай' : 'continue';
}

export function turnPlanPrimaryActionKey(
	tool: string | null | undefined
): 'ewaCompanion.turnPlanActionStart' | 'ewaCompanion.turnPlanActionContinue' {
	const id = (tool || '').trim();
	if (MUSIC_TOOLS.has(id)) {
		return 'ewaCompanion.turnPlanActionStart';
	}
	return 'ewaCompanion.turnPlanActionContinue';
}
