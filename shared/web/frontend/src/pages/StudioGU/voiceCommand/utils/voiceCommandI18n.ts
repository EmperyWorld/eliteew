/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n helpers for Voice Command Center: response resolution, locale dates, audit/history status labels.
 *
 * Invariants:
 * - Speech trigger phrases stay in commandCatalog; UI descriptions use catalog.* keys.
 *
 * Related:
 * - `engine/commandExecutor.ts`, `desktopUi.voiceCommand` locale namespace
 */

import type { TFunction } from 'i18next';
import type { ExecutionResult } from '../engine/commandExecutor';

export type VoiceCommandT = TFunction<'desktopUi', 'voiceCommand'>;

/** BCP-47 tag for Intl formatters from active i18n language. */
export function voiceCommandLocaleTag(language: string | undefined): string {
	if (language?.toLowerCase().startsWith('en')) return 'en-US';
	return 'ru-RU';
}

export function formatVoiceCommandTime(
	date: Date,
	language: string | undefined,
	options: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit',
	}
): string {
	return date.toLocaleTimeString(voiceCommandLocaleTag(language), options);
}

export function formatVoiceCommandDateTime(
	isoOrDate: string | Date,
	language: string | undefined
): string {
	const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
	return date.toLocaleString(voiceCommandLocaleTag(language));
}

export function resolveExecutionResponse(
	result: ExecutionResult,
	t: VoiceCommandT,
	language?: string
): string {
	if (result.responseKey === 'date') {
		const today = new Date();
		const dateFormatted = today.toLocaleDateString(
			voiceCommandLocaleTag(language),
			{
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			}
		);
		return t('responses.date', { date: dateFormatted });
	}
	if (result.responseKey === 'create_folder' && !result.responseParams?.name) {
		return t('responses.create_folder_default');
	}
	return t(`responses.${result.responseKey}` as never, {
		...(result.responseParams ?? {}),
		defaultValue: result.responseKey,
	});
}

export type HistoryStatus = 'success' | 'error' | 'cancelled';

export function historyStatusLabel(
	status: HistoryStatus,
	t: VoiceCommandT
): string {
	return t(`history.status.${status}`);
}

/** Maps server audit status strings to localized chip labels. */
export function auditStatusLabel(status: string, t: VoiceCommandT): string {
	const normalized = status.toLowerCase();
	if (
		normalized === 'success' ||
		normalized === 'error' ||
		normalized === 'cancelled'
	) {
		return historyStatusLabel(normalized, t);
	}
	return status;
}

export function catalogDescription(
	commandId: string,
	t: VoiceCommandT
): string {
	return t(`catalog.${commandId}` as never, { defaultValue: commandId });
}

export const DEFAULT_MACRO_ID = 'macro-workplace';

export function macroDisplayName(
	macro: { id: string; name: string },
	t: VoiceCommandT
): string {
	if (macro.id === DEFAULT_MACRO_ID) {
		return t('macros.defaultWorkplaceName');
	}
	return macro.name;
}
