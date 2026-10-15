/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for Professional Worlds media workbench; thin re-export facade.
 *
 * Invariants:
 * - Named exports `ProfessionalMediaWorkbench`, `PW_FALLBACK_PHOTO_PRESETS`, and
 *   `ProfessionalMediaContextType` stay on this path for existing importers.
 * - Implementation lives under ./mediaWorkbench/ (parent facade ≤400 LOC; each child ≤500 LOC).
 *
 * Related:
 * - mediaWorkbench/ProfessionalMediaWorkbench.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 * - documentation/product/PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md
 */

export { ProfessionalMediaWorkbench } from './mediaWorkbench/ProfessionalMediaWorkbench';
export { PW_FALLBACK_PHOTO_PRESETS } from './mediaWorkbench/constants';
export type { ProfessionalMediaContextType } from './mediaWorkbench/types';
export type { ProfessionalMediaWorkbenchProps } from './mediaWorkbench/types';
