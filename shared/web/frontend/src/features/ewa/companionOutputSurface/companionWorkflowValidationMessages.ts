/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map server-side user workflow validation warning codes to i18n keys.
 *
 * Related:
 * - useCompanionDagBuilderLoadSave.ts
 */

import type { TFunction } from 'i18next';

export type CompanionUserWorkflowValidateResult = {
	ok: boolean;
	errors: string[];
	warnings: string[];
	execution_mode: string;
	preview_steps: Array<{
		step_index: number;
		tool_name: string;
		title_ru: string;
		title_en: string;
		async_step: boolean;
		requires_confirm: boolean;
		missing_recommended_fields: string[];
	}>;
};

export function mapWorkflowValidationWarning(
	code: string,
	t: TFunction<'marketing'>
): string {
	if (code === 'duplicate_trigger_phrase') {
		return t('ewaCompanion.userWorkflowWarningDuplicateTrigger');
	}
	if (code === 'trigger_phrase_too_short') {
		return t('ewaCompanion.userWorkflowWarningTriggerShort');
	}
	if (code === 'trigger_phrase_too_vague') {
		return t('ewaCompanion.userWorkflowWarningTriggerVague');
	}
	if (code === 'trigger_phrase_collision') {
		return t('ewaCompanion.userWorkflowWarningTriggerCollision');
	}
	if (code === 'multiple_async_steps') {
		return t('ewaCompanion.userWorkflowWarningMultipleAsync');
	}
	if (code === 'sync_step_after_async') {
		return t('ewaCompanion.userWorkflowWarningSyncAfterAsync');
	}
	if (code === 'confirm_step_not_last') {
		return t('ewaCompanion.userWorkflowWarningConfirmNotLast');
	}
	if (code.startsWith('step_') && code.includes('_missing_recommended:')) {
		const fields = code.split(':')[1] ?? '';
		return t('ewaCompanion.userWorkflowWarningStepMissingFields', {
			fields,
		});
	}
	return code;
}

export function mapWorkflowValidationError(
	code: string,
	t: TFunction<'marketing'>
): string {
	if (code.startsWith('step_') && code.includes('_missing_required:')) {
		const fields = code.split(':')[1] ?? '';
		return t('ewaCompanion.userWorkflowErrorStepMissingRequired', {
			fields,
		});
	}
	return mapWorkflowValidationWarning(code, t);
}
