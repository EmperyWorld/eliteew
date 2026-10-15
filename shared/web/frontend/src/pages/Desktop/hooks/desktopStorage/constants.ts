/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared constants for `useDesktopStorage` composition (Wave B atomization).
 *
 * Invariants:
 * - SYNC_DEBOUNCE_MS aliases DESKTOP_STORAGE_SYNC_DEBOUNCE_MS from types.
 * - DEFAULT_CONFIG aliases DEFAULT_DESKTOP_STORAGE_CONFIG (same object reference).
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - hooks/useDesktopStorage.types.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md §4.1
 */

import { STORAGE_KEYS } from '../../constants';
import {
	DEFAULT_DESKTOP_STORAGE_CONFIG,
	DESKTOP_STORAGE_SYNC_DEBOUNCE_MS,
} from '../useDesktopStorage.types';

export const SYNC_DEBOUNCE_MS = DESKTOP_STORAGE_SYNC_DEBOUNCE_MS;
export const STORAGE_SYNC_META_KEY = `${STORAGE_KEYS.CONFIG}:sync_meta`;
export const DEFAULT_CONFIG = DEFAULT_DESKTOP_STORAGE_CONFIG;
/** Stall banner after this many ms while `isLoading` stays true. */
export const LOAD_STALL_MS = 12_000;
