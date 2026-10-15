/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query keys for admin user detail panel data sources.
 *
 * Invariants:
 * - Access-groups key is shared with desktop admin users list invalidation.
 *
 * Related:
 * - `pages/Admin/adminUserDetail/useAdminUserDetailPanel.ts`
 */

export const GROUPS_QK = ['desktop', 'admin', 'access-groups'] as const;
