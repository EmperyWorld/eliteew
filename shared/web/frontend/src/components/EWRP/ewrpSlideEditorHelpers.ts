/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for EWRP slide editor UGS actions: prompt validation, enablement, disabled tooltips.
 *
 * Invariants:
 * - Image prompt minimum length matches server validation in slide editor modals.
 *
 * Related:
 * - `ewrpStatusResponse.ts`, `ewrpHttpErrors.ts`, `ewrpApi.ts`
 */

import { ewrpSlideEditorJobBusy } from './ewrpClientJobPolicy';

export { extractEwrpApiErrorDetail } from './ewrpHttpErrors';
export { parseEwrpStatusResponse } from './ewrpStatusResponse';

/** Minimum prompt length before POST regenerate-image (client guard). */
export const EWRP_SLIDE_IMAGE_PROMPT_MIN_LEN = 4;

export function isEwrpSlideImagePromptValid(
	prompt: string,
	minLen: number = EWRP_SLIDE_IMAGE_PROMPT_MIN_LEN
): boolean {
	return prompt.trim().length >= minLen;
}

/** UGS dropdown + modals disabled while job busy or another slide is submitting. */
export function ewrpSlideEditorAiDisabled(options: {
	jobId: string | null;
	status: string | null | undefined;
	busySlideIndex: number | null;
}): boolean {
	const { jobId, status, busySlideIndex } = options;
	return !jobId || ewrpSlideEditorJobBusy(status) || busySlideIndex !== null;
}

/** Tooltip when UGS menu trigger is disabled. */
export function ewrpSlideEditorDisabledTitle(
	options: {
		jobId: string | null;
		status: string | null | undefined;
		busySlideIndex: number | null;
		rowBusy: boolean;
	},
	t: (key: string) => string
): string {
	if (!options.rowBusy && !ewrpSlideEditorAiDisabled(options)) {
		return t('slideEditor.ugsMenuTitle');
	}
	if (options.rowBusy) {
		return t('slideEditor.starting');
	}
	if (options.busySlideIndex !== null) {
		return t('slideEditor.disabledOtherSlideBusy');
	}
	if (ewrpSlideEditorJobBusy(options.status)) {
		return t('notify.waitForRebuildSub');
	}
	return t('slideEditor.ugsMenuTitle');
}
