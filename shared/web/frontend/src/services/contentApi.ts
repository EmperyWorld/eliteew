/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public entry for Unified Content REST facade; implementation lives under contentApi/.
 *
 * Invariants:
 * - Import path `@/services/contentApi` remains stable via barrel re-export.
 *
 * Related:
 * - src/services/contentApi/index.ts
 * - src/generated/content-openapi.ts
 */
export * from './contentApi/index';
