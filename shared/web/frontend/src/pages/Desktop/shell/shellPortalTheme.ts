/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell-owned re-export of desktop portal theme tokens (U1.d). Apps should not
 * import getDesktopPortalShellProps from desktopUi for new overlays.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md §5.4
 * - utils/desktopUi.ts
 */

export { getDesktopPortalShellProps } from '../utils/desktopUi';
