/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for Site Manager Ops; thin re-export facade.
 *
 * Invariants:
 * - Named export SiteManagerOpsPanel and default export both preserved for lazy/admin mounts.
 * - Implementation lives under ./siteManagerOps/ (≤800 LOC per child).
 *
 * Related:
 * - siteManagerOps/SiteManagerOpsPanel.tsx
 * - documentation/product/SITE-STUDIO.md
 */

export { SiteManagerOpsPanel } from './siteManagerOps/SiteManagerOpsPanel';
export { default } from './siteManagerOps/SiteManagerOpsPanel';
