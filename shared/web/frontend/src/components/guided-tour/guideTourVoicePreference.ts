/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guided tour narrator voice preference (po&T man / TZBrand woman) and WAV path builder.
 *
 * Invariants:
 * - WAV layout: `public/audio/<tour>/<locale>/<man|woman>/<stepId>.wav`.
 * - TTS mapping: man → `man_1`, woman → `baya`.
 *
 * Related:
 * - guideTourWavUrl.ts, GuideTourVoiceSelector.tsx, GUIDED-TOUR-EXCURSION.md
 */

export type GuideTourVoiceKey = 'man' | 'woman';
export type GuideTourNarrationLocale = 'ru' | 'en';

export const GUIDE_TOUR_VOICE_LS_KEY = 'eliteew.guide-tour.voice';

export type GuideTourVoiceProfile = {
	readonly key: GuideTourVoiceKey;
	readonly ttsVoice: string;
	readonly displayName: string;
};

export const GUIDE_TOUR_VOICE_PROFILES: Record<
	GuideTourVoiceKey,
	GuideTourVoiceProfile
> = {
	man: {
		key: 'man',
		ttsVoice: 'man_1',
		displayName: 'po&T',
	},
	woman: {
		key: 'woman',
		ttsVoice: 'baya',
		displayName: 'TZBrand',
	},
} as const;

export const GUIDE_TOUR_VOICE_KEYS: readonly GuideTourVoiceKey[] = [
	'man',
	'woman',
];

export function normalizeGuideTourLocale(
	language: string | undefined
): GuideTourNarrationLocale {
	if (!language) return 'ru';
	const base = language.split('-')[0]?.toLowerCase();
	return base === 'en' ? 'en' : 'ru';
}

export function readGuideTourVoicePreference(): GuideTourVoiceKey {
	if (typeof window === 'undefined') return 'woman';
	try {
		const stored = window.localStorage.getItem(GUIDE_TOUR_VOICE_LS_KEY);
		if (stored === 'man' || stored === 'woman') return stored;
	} catch {
		/* private mode */
	}
	return 'woman';
}

export function writeGuideTourVoicePreference(voice: GuideTourVoiceKey): void {
	try {
		window.localStorage.setItem(GUIDE_TOUR_VOICE_LS_KEY, voice);
	} catch {
		/* private mode */
	}
}

export function buildGuideTourWavUrl(
	tourFolder: string,
	stepId: string,
	locale: GuideTourNarrationLocale,
	voice: GuideTourVoiceKey
): string {
	return `${import.meta.env.BASE_URL}audio/${tourFolder}/${locale}/${voice}/${stepId}.wav`;
}

/** Legacy flat path before voice/locale matrix (migration fallback). */
export function buildGuideTourLegacyWavUrl(
	tourFolder: string,
	stepId: string,
	locale: GuideTourNarrationLocale = 'ru'
): string {
	return `${import.meta.env.BASE_URL}audio/${tourFolder}/${locale}/${stepId}.wav`;
}
