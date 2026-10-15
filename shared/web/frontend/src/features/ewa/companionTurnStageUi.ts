/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map companion SSE ``turn_stage`` payloads to i18n keys for the thinking hint strip.
 *
 * Invariants:
 * - Unknown stages fall back to generic thinking hints in the panel.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { CompanionTurnStagePayload } from '@/services/ewa/ewaCompanionChatApi';

export function companionTurnStageHintKey(
	payload: CompanionTurnStagePayload | null
): string | null {
	if (!payload?.stage) return null;
	if (payload.stage === 'preparing_context') {
		return payload.heavy_steps_skipped
			? 'ewaCompanion.turnStage.preparingContextLight'
			: 'ewaCompanion.turnStage.preparingContext';
	}
	if (payload.stage === 'composing_reply') {
		return 'ewaCompanion.turnStage.composingReply';
	}
	if (payload.stage === 'web_search') {
		return 'ewaCompanion.turnStage.webSearch';
	}
	return null;
}
