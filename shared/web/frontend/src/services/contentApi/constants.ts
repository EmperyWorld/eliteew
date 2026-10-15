/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified content REST path constants shared across client modules.
 *
 * Invariants:
 * - Base prefix matches `shared/api/domains/content.py` mount.
 *
 * Related:
 * - src/services/contentApi/index.ts
 */

/** Unified content REST prefix (`shared/api/domains/content.py`). */
export const CONTENT_API_V1_BASE = '/api/v1' as const;

export const CONTENT_API_BASE = CONTENT_API_V1_BASE;
