/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for useDesktopExpansionSettings (P31 atomization).
 * Implementation lives in `./desktopExpansionSettings/*`.
 *
 * Invariants:
 * - `export function useDesktopExpansionSettings` remains importable from this path.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - DesktopSettingsExpansionSection.tsx
 */

export {
	useDesktopExpansionSettings,
	type UseDesktopExpansionSettingsParams,
} from './desktopExpansionSettings/useDesktopExpansionSettings';
