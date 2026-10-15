/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P4 semantic UI contracts for Desktop Shell chrome — focus, reachability,
 * viewport clamp, and destructive confirms. Registry/chrome SSOT pointer;
 * enforcement lives in portal host, geometry helpers, and VD confirm UI.
 *
 * Invariants:
 * - Contracts are declarative; do not invent alternate chrome rules per app.
 * - L5/L6 Vitest laws lock focus restore and work-area ⊆ geometry.
 *
 * Related:
 * - shellPortal.tsx (focus trap + restore)
 * - utils/desktopWindowGeometry.ts (resolveEffectiveWindowMinSize)
 * - components/VirtualDesktopDeleteConfirm.tsx
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

export const SHELL_SEMANTIC_CONTRACTS = {
	/** Portals/modals own trap + restore; Start cards use sibling controls (no nested buttons). */
	focus: 'portal_trap_and_restore_and_start_sibling_controls',
	/** Off-screen chrome must not leave tab-stops (inert / absolute seat above taskbar). */
	reachability: 'in_viewport_or_inert',
	/** Open/resize geometry ⊆ work area; registered min capped; work-area RO fits non-max windows. */
	viewport: 'geometry_subseteq_work_area',
	/** Virtual desktop delete requires explicit confirm (never silent). */
	destructive: 'vd_delete_confirmable',
} as const;

export type ShellSemanticContractId =
	(typeof SHELL_SEMANTIC_CONTRACTS)[keyof typeof SHELL_SEMANTIC_CONTRACTS];
