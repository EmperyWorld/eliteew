/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for guided-tour narrator voice paths and locale normalization.
 */

import { describe, expect, it } from 'vitest';
import {
	buildGuideTourWavUrl,
	GUIDE_TOUR_VOICE_PROFILES,
	normalizeGuideTourLocale,
} from '@/components/guided-tour/guideTourVoicePreference';

describe('guideTourVoicePreference', () => {
	it('maps man to po&T / man_1 and woman to TZBrand / baya', () => {
		expect(GUIDE_TOUR_VOICE_PROFILES.man.displayName).toBe('po&T');
		expect(GUIDE_TOUR_VOICE_PROFILES.man.ttsVoice).toBe('man_1');
		expect(GUIDE_TOUR_VOICE_PROFILES.woman.displayName).toBe('TZBrand');
		expect(GUIDE_TOUR_VOICE_PROFILES.woman.ttsVoice).toBe('baya');
	});

	it('builds WAV path with locale and voice segment', () => {
		expect(buildGuideTourWavUrl('ugs-hub-guide', 'intro', 'ru', 'man')).toBe(
			'/audio/ugs-hub-guide/ru/man/intro.wav'
		);
		expect(buildGuideTourWavUrl('ugs-hub-guide', 'intro', 'en', 'woman')).toBe(
			'/audio/ugs-hub-guide/en/woman/intro.wav'
		);
	});

	it('normalizes i18n language to ru or en', () => {
		expect(normalizeGuideTourLocale('en-US')).toBe('en');
		expect(normalizeGuideTourLocale('ru-RU')).toBe('ru');
		expect(normalizeGuideTourLocale(undefined)).toBe('ru');
	});
});
