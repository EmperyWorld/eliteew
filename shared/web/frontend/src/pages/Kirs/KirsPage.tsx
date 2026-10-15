/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for KIRS curation page; thin re-export facade.
 *
 * Invariants:
 * - Named export KirsPage and default export both preserved for lazyImports.
 * - Implementation lives under ./kirsPage/ (≤800 LOC per child).
 *
 * Related:
 * - kirsPage/KirsPage.tsx
 * - documentation/product/KIRS-SITE-CURATION.md
 */

export { KirsPage } from './kirsPage/KirsPage';
export { default } from './kirsPage/KirsPage';
