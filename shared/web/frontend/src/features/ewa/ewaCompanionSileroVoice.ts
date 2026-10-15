/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map EWA companion persona id → Qwen3 voice-clone profile (per-companion reference WAV).
 *
 * Invariants:
 * - Persona → voice map is loaded from canonical ``voice_contract.json`` (synced from stack9).
 * - Server accepts profile id via voice-gateway synthesize body.
 *
 * Related:
 * - src/data/qwen3_tts_voice_contract.json
 * - docker/data/stack9/qwen3-tts/voice_contract.json
 * - src/features/ewa/useEwaCompanionVoiceOutput.ts
 */
import voiceContract from '@/data/qwen3_tts_voice_contract.json';
import {
	DEFAULT_EWA_PERSONA_ID,
	EWA_PERSONA_IDS,
	normalizeEwaPersonaId,
	type EwaPersonaId,
} from '@/features/ewa/ewaPersonaCatalog';

/** Qwen3 voice profile ids (see ``docker/data/stack9/qwen3-tts/voice_profiles.json``). */
export type EwaCompanionTtsVoiceId =
	| 'woman_1'
	| 'woman_2'
	| 'man_1'
	| 'man_2'
	| 'companion_ewa'
	| 'companion_mela'
	| 'companion_zera'
	| 'companion_kora'
	| 'companion_tala'
	| 'companion_feni'
	| 'companion_arlika'
	| 'companion_arlika_v2';

/** @deprecated use EwaCompanionTtsVoiceId */
export type EwaCompanionSileroVoiceId = EwaCompanionTtsVoiceId;

const PERSONA_TTS_VOICE = voiceContract.persona_voices as Record<
	EwaPersonaId,
	EwaCompanionTtsVoiceId
>;

const DEFAULT_EWA_COMPANION_TTS_VOICE: EwaCompanionTtsVoiceId =
	(PERSONA_TTS_VOICE.parent as EwaCompanionTtsVoiceId | undefined) ??
	'companion_ewa';

/** Canonical contract persona keys (for sync tests). */
export const EWA_COMPANION_TTS_PERSONA_VOICE_MAP: Readonly<
	Record<EwaPersonaId, EwaCompanionTtsVoiceId>
> = PERSONA_TTS_VOICE;

/** Every catalog persona must have a TTS profile in voice_contract.json. */
export function assertCompanionPersonaVoiceContract(): void {
	for (const personaId of EWA_PERSONA_IDS) {
		if (!PERSONA_TTS_VOICE[personaId]) {
			throw new Error(
				`voice_contract.json missing persona_voices.${personaId}`
			);
		}
	}
}

/** Qwen3 voice-clone profile for companion TTS (see stack9 voice_profiles.json). */
export function ewaPersonaTtsVoice(
	personaId: string | null | undefined
): EwaCompanionTtsVoiceId {
	const id = normalizeEwaPersonaId(personaId ?? '') ?? DEFAULT_EWA_PERSONA_ID;
	return PERSONA_TTS_VOICE[id] ?? DEFAULT_EWA_COMPANION_TTS_VOICE;
}

/** @deprecated alias for ewaPersonaTtsVoice */
export function ewaPersonaSileroVoice(
	personaId: string | null | undefined
): EwaCompanionTtsVoiceId {
	return ewaPersonaTtsVoice(personaId);
}
