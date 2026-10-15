/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable facade barrel for context system types — re-exports from contextDomain/.
 *
 * Invariants:
 * - Export-only; no runtime logic. Import path @/types/context remains stable.
 *
 * Related:
 * - ./contextDomain/ (enums, models, schemas, guards, validators, helpers, templateVariables)
 * - ./index.ts (partial type re-exports)
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md §Types atomization
 */

export * from './contextDomain/enums';
export * from './contextDomain/models';
export * from './contextDomain/schemas';
export * from './contextDomain/guards';
export * from './contextDomain/validators';
export * from './contextDomain/helpers';
export * from './contextDomain/templateVariables';
