/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Timing and ducking constants for desktop now-playing transport.
 *
 * Invariants:
 * - Shell persist debounce and stall hint thresholds match product contracts.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 */

export const LEGACY_LOCAL_STORAGE_KEY = 'eliteew-nowplaying';
export const DUCK_VOLUME = 0.2;
export const DUCK_TRANSITION_MS = 300;
/** Debounce for durable shell-state writes (track + volume only). */
export const NOW_PLAYING_SHELL_DEBOUNCE_MS = 2000;
/** Tab-scoped position checkpoint during playback (not shell-state). */
export const POSITION_SESSION_DEBOUNCE_MS = 3000;
/** User-visible stall hint when playback prep exceeds this without canplay/error. */
export const NOW_PLAYING_LOAD_STALL_MS = 15_000;
