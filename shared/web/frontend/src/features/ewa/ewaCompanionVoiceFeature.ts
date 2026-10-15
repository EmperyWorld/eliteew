/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve whether companion voice UI (mic + TTS playback) is enabled for this deployment.
 *
 * Invariants:
 * - Server flag on companion profile GET is authoritative; local default is false.
 *
 * Related:
 * - api/ewa_platform/companion/voice/config.py
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

export function isEwaCompanionVoiceFeatureEnabled(
	profile: Pick<EwaCompanionProfileOut, 'voice_enabled'> | null | undefined
): boolean {
	return profile?.voice_enabled === true;
}
