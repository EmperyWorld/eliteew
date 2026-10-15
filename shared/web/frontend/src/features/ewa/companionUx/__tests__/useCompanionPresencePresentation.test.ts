/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionPresencePresentation (U8.3 slice 12).
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_EWA_PERSONA_ID } from '@/features/ewa/ewaPersonaCatalog';
import { useCompanionPresencePresentation } from '@/features/ewa/companionUx/useCompanionPresencePresentation';

const baseProfile = {
	learned_preferences: {},
	companion_revision: 3,
	memory_display: [],
	character_state: {
		seed_persona_id: 'ewa',
		mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
		bond: { trust: 0, familiarity: 0, repair_need: 0 },
		interaction_style: { answer_length: 0, initiative: 0, reassurance: 0 },
	},
};

describe('useCompanionPresencePresentation', () => {
	it('marks presence as thinking while pending', () => {
		const { result } = renderHook(() =>
			useCompanionPresencePresentation({
				profile: baseProfile,
				personaId: DEFAULT_EWA_PERSONA_ID,
				ru: false,
				pending: true,
				reducedMotion: false,
				streamingText: '',
				isDesktopWindowActive: true,
				t: ((key: string) => key) as never,
			})
		);
		expect(result.current.presence).toBe('thinking');
	});

	it('exposes display name from persona catalog', () => {
		const { result } = renderHook(() =>
			useCompanionPresencePresentation({
				profile: baseProfile,
				personaId: DEFAULT_EWA_PERSONA_ID,
				ru: true,
				pending: false,
				reducedMotion: false,
				streamingText: '',
				isDesktopWindowActive: true,
				t: ((key: string) => key) as never,
			})
		);
		expect(result.current.displayName.length).toBeGreaterThan(0);
		expect(result.current.paletteStyle).toBeDefined();
	});
});
