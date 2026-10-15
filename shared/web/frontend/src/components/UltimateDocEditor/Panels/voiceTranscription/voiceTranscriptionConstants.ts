/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Upload size limits for voice transcription panel audio files.
 *
 * Invariants:
 * - MAX_AUDIO_FILE_MB and derived bytes gate must stay in sync with UI error copy.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts
 */

export const MAX_AUDIO_FILE_MB = 50;
export const MAX_AUDIO_FILE_BYTES = MAX_AUDIO_FILE_MB * 1024 * 1024;
