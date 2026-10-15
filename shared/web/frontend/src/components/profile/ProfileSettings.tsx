/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility re-export — identity editing lives in ProfileIdentityPanel.
 * Privacy/password are mounted by UserProfile shell, not this module.
 *
 * Invariants:
 * - Prefer importing ProfileIdentityPanel or UserProfile directly.
 *
 * Related:
 * - ProfileIdentityPanel.tsx
 * - ../UserProfile.tsx
 */

export { default } from './ProfileIdentityPanel';
