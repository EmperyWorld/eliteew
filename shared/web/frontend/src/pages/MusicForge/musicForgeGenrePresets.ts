/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Curated genre quick presets for MusicForge create form (style_hint keys).
 *
 * Invariants:
 * - `style` values match API MUSIC_STYLE_FORM_DEFAULTS / mobile UGS catalog keys.
 * - Desktop shows a short curated list; full catalog stays in advanced free-text.
 *
 * Related:
 * - pack-cloud/mobile/.../UgsSongGenrePresets.kt
 * - MusicForgeCreatePanel.tsx
 */

export type MusicForgeGenrePreset = {
	style: string;
	labelKey: string;
};

/** Premium create-form subset — aligned with UGS v2 style keys. */
export const MUSIC_FORGE_GENRE_QUICK_PRESETS: MusicForgeGenrePreset[] = [
	{ style: 'pop', labelKey: 'musicForge.genres.pop' },
	{ style: 'rock', labelKey: 'musicForge.genres.rock' },
	{ style: 'electronic', labelKey: 'musicForge.genres.electronic' },
	{ style: 'ballad', labelKey: 'musicForge.genres.ballad' },
	{ style: 'hip_hop', labelKey: 'musicForge.genres.hipHop' },
	{ style: 'house', labelKey: 'musicForge.genres.house' },
	{ style: 'indie_rock', labelKey: 'musicForge.genres.indieRock' },
	{ style: 'dance_pop', labelKey: 'musicForge.genres.dancePop' },
	{ style: 'lofi_chill', labelKey: 'musicForge.genres.lofiChill' },
	{ style: 'folk', labelKey: 'musicForge.genres.folk' },
	{ style: 'synthwave', labelKey: 'musicForge.genres.synthwave' },
	{ style: 'rnb_classic_female', labelKey: 'musicForge.genres.rnbSoul' },
];
