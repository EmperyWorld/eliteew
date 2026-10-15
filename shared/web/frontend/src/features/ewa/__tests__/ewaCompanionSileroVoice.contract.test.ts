/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensure frontend persona → TTS voice map stays aligned with stack9 voice_contract.json.
 *
 * Invariants:
 * - Every EWA persona id has a companion_* (or parent) profile in the synced contract.
 *
 * Related:
 * - src/data/qwen3_tts_voice_contract.json
 */
import { describe, expect, it } from 'vitest';
import voiceContract from '@/data/qwen3_tts_voice_contract.json';
import { EWA_PERSONA_IDS } from '@/features/ewa/ewaPersonaCatalog';
import {
	assertCompanionPersonaVoiceContract,
	ewaPersonaTtsVoice,
} from '@/features/ewa/ewaCompanionSileroVoice';

describe('qwen3 voice contract sync', () => {
	it('covers every catalog persona', () => {
		expect(() => assertCompanionPersonaVoiceContract()).not.toThrow();
		for (const personaId of EWA_PERSONA_IDS) {
			expect(voiceContract.persona_voices[personaId]).toBeTruthy();
			expect(ewaPersonaTtsVoice(personaId)).toBe(
				voiceContract.persona_voices[personaId]
			);
		}
	});

	it('maps mela to companion_mela', () => {
		expect(ewaPersonaTtsVoice('mela')).toBe('companion_mela');
	});
});
