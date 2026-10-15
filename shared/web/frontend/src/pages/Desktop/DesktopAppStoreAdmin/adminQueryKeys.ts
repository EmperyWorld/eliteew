/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query key prefix for Desktop App Store admin tabs (non-chrome).
 *
 * Invariants:
 * - Keep stable so cache invalidation across Catalog / Maintenance / Storefront stays aligned.
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

export const ADMIN_QUERY_KEY = ['desktop', 'admin'] as const;
