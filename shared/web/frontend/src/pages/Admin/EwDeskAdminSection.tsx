/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for EWDesk admin section; thin re-export facade.
 *
 * Invariants:
 * - Named export EwDeskAdminSection preserved for AdminSectionLazy.
 * - Implementation lives under ./ewDeskAdmin/ (≤800 LOC per child).
 * - Sibling modules (EwDeskMarkdownToolbar, EwDeskContentImagePicker, …) stay in parent Admin/.
 *
 * Related:
 * - ewDeskAdmin/EwDeskAdminSection.tsx
 * - documentation/product/desktop/EWDESK-NEWS.md
 * - documentation/platform/UNIFIED-ADMIN-SHELL.md
 */

export { EwDeskAdminSection } from './ewDeskAdmin/EwDeskAdminSection';
