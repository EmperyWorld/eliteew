/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for DesktopWidgetsPanel (P32 atomization).
 * Implementation lives in `./desktopWidgetsPanel/*`.
 *
 * Invariants:
 * - `DesktopWidgetsPanel` and `DesktopWidgetsPanelProps` remain importable from this path.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - DesktopWorkspaceCanvas.tsx
 */

export { DesktopWidgetsPanel } from './desktopWidgetsPanel/DesktopWidgetsPanel';
export type { DesktopWidgetsPanelProps } from './desktopWidgetsPanel/types';
