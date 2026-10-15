/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Safe one-click retry prompts for failed companion operations (U4.6).
 *
 * Invariants:
 * - Only intents with deterministic server-side retry paths get prompts; unknown → null.
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-QUICK-INTENTS.md
 */

import type { TFunction } from 'i18next';

const SAFE_RETRY_INTENTS = new Set([
	'music_generation_background',
	'music_generation_xl_base_background',
	'image_generation_background',
	'presentation_generation_background',
	'user_action_workflow',
]);

export function companionRetryPromptForIntent(
	intentKind: string | null | undefined,
	t: TFunction<'marketing', undefined>
): string | null {
	const kind = (intentKind || '').trim().toLowerCase();
	if (!SAFE_RETRY_INTENTS.has(kind)) return null;
	if (kind.includes('music')) {
		return t('ewaCompanion.operationRetryMusicPrompt');
	}
	if (kind.includes('image')) {
		return t('ewaCompanion.operationRetryImagePrompt');
	}
	if (kind.includes('presentation')) {
		return t('ewaCompanion.operationRetryPresentationPrompt');
	}
	if (kind === 'user_action_workflow') {
		return t('ewaCompanion.operationRetryWorkflowPrompt');
	}
	return null;
}
