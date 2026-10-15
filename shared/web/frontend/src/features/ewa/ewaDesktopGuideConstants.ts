/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants for EWA Desktop guided tour (root id, audio LS key, WAV paths).
 *
 * Invariants:
 * - WAV filenames match step `id` in `EwaDesktopGuideModal` and `narrations.ru.json`.
 *
 * Related:
 * - features/ewa/EwaDesktopGuideModal.tsx
 * - public/audio/ewa-desktop-guide/
 * - documentation/product/GUIDED-TOUR-BACKLOG.md
 */

export const EWA_DESKTOP_GUIDE_ROOT_ID = 'ewa-desktop-guide-root';

export const EWA_DESKTOP_GUIDE_TOUR_FOLDER = 'ewa-desktop-guide';

export const EWA_DESKTOP_GUIDE_AUDIO_LS_KEY = 'ewa-desktop-guide-audio-enabled';

/** @deprecated Prefer `useGuideTourResolvedAudioPath(EWA_DESKTOP_GUIDE_TOUR_FOLDER)`. */
export function ewaDesktopGuideWavUrl(stepId: string): string {
	return `${import.meta.env.BASE_URL}audio/ewa-desktop-guide/ru/${stepId}.wav`;
}
