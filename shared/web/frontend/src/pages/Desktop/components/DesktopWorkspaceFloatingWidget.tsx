/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for DesktopWorkspaceFloatingWidget (P34 atomization).
 * Implementation lives in `./desktopWorkspaceFloatingWidget/*`.
 *
 * Invariants:
 * - `DesktopWorkspaceFloatingWidget` and `DesktopWorkspaceFloatingWidgetProps` remain importable from this path.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - DesktopWorkspaceCanvas.tsx
 */

export { DesktopWorkspaceFloatingWidget } from './desktopWorkspaceFloatingWidget/DesktopWorkspaceFloatingWidget';
export type { DesktopWorkspaceFloatingWidgetProps } from './desktopWorkspaceFloatingWidget/types';
