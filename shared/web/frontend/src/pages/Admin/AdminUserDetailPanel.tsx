/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for admin user detail side panel; thin re-export facade.
 *
 * Invariants:
 * - Named export AdminUserDetailPanel preserved for AdminUsersHubSection.
 * - Implementation lives under ./adminUserDetail/ (≤800 LOC per child).
 * - Shared row types stay in adminDirectoryUserTypes.ts (do not re-export from here).
 *
 * Related:
 * - adminUserDetail/AdminUserDetailPanel.tsx
 * - documentation/platform/UNIFIED-ADMIN-SHELL.md
 * - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
 */

export { AdminUserDetailPanel } from './adminUserDetail/AdminUserDetailPanel';
export type { AdminUserDetailPanelProps } from './adminUserDetail/types';
