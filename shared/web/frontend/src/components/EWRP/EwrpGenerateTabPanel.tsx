/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import facade for the EWRP Generate-tab presentational panel.
 * Implementation lives under `ewrpGenerateTab/`.
 *
 * Invariants:
 * - Named exports `EwrpGenerateTabPanel` + `EwrpGenerateTabPanelProps` preserved for Main:
 *   `import { EwrpGenerateTabPanel } from './EwrpGenerateTabPanel'`
 * - Facade stays ≤50 LOC; no second store.
 *
 * Related:
 * - `ewrpGenerateTab/EwrpGenerateTabPanel.tsx`
 * - `EWRPGeneratorMain.tsx`
 * - `documentation/product/EWRP-EDITOR.md`
 */

export { EwrpGenerateTabPanel } from './ewrpGenerateTab/EwrpGenerateTabPanel';
export type { EwrpGenerateTabPanelProps } from './ewrpGenerateTab/ewrpGenerateTabTypes';
