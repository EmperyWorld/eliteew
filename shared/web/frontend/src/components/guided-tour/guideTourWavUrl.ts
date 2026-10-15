/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build static WAV URL for spotlight guided tours under `public/audio/<folder>/`.
 *
 * Invariants:
 * - Filenames match step `id` in tour config and narrations JSON.
 * - Layout: `<locale>/<man|woman>/<stepId>.wav`.
 *
 * Related:
 * - guideTourVoicePreference.ts, SpotlightGuideModal.tsx
 */

import {
	buildGuideTourWavUrl,
	normalizeGuideTourLocale,
	readGuideTourVoicePreference,
	type GuideTourNarrationLocale,
	type GuideTourVoiceKey,
} from '@/components/guided-tour/guideTourVoicePreference';

export function guideTourWavUrl(
	tourFolder: string,
	stepId: string,
	locale: GuideTourNarrationLocale = 'ru',
	voice: GuideTourVoiceKey = readGuideTourVoicePreference()
): string {
	return buildGuideTourWavUrl(tourFolder, stepId, locale, voice);
}

export function guideTourWavUrlFromLanguage(
	tourFolder: string,
	stepId: string,
	language: string | undefined
): string {
	return buildGuideTourWavUrl(
		tourFolder,
		stepId,
		normalizeGuideTourLocale(language),
		readGuideTourVoicePreference()
	);
}
