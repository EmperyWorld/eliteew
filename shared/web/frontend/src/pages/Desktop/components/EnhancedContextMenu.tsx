/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for EnhancedContextMenu (P30 atomization).
 * Implementation lives in `./enhancedContextMenu/*`.
 *
 * Invariants:
 * - All public symbols remain importable from this path (zero consumer changes).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - components/DesktopWorkspaceCanvas.tsx
 */

export { EnhancedContextMenu } from './enhancedContextMenu/EnhancedContextMenu';

export type {
	ContextMenuItem,
	ContextMenuPosition,
	EnhancedContextMenuProps,
} from './enhancedContextMenu/types';
