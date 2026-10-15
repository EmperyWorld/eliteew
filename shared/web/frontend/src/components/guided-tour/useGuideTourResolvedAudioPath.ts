/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve guided-tour WAV URL from tour folder, UI locale, and narrator voice preference.
 *
 * Related:
 * - SpotlightGuideModal.tsx, CreativeStudioGuideTourModal.tsx
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
	buildGuideTourWavUrl,
	normalizeGuideTourLocale,
} from '@/components/guided-tour/guideTourVoicePreference';
import { useGuideTourVoicePreference } from '@/components/guided-tour/useGuideTourVoicePreference';

export function useGuideTourResolvedAudioPath(
	tourAudioFolder: string,
	override?: (stepId: string) => string | null | undefined
): (stepId: string) => string {
	const { i18n } = useTranslation();
	const [voice] = useGuideTourVoicePreference();
	const locale = normalizeGuideTourLocale(i18n.language);

	return useCallback(
		(stepId: string) => {
			const custom = override?.(stepId);
			if (custom === '') return '';
			if (custom) return custom;
			return buildGuideTourWavUrl(tourAudioFolder, stepId, locale, voice);
		},
		[tourAudioFolder, locale, voice, override]
	);
}
