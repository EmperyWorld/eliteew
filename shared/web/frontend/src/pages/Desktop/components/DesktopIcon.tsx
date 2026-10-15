/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for draggable desktop icon (P29 atomization).
 * Implementation lives in `./desktopIcon/*`.
 *
 * Invariants:
 * - All public symbols remain importable from this path (zero consumer changes).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - hooks/useDesktopWorkspaceIconInteractions.ts
 */

export {
	ICON_VISUAL_STYLES,
	ICON_STYLE_CARD_SAMPLE_APPS,
} from './desktopIcon/iconVisualStyles';

export { DesktopIcon, default } from './desktopIcon/DesktopIcon';

export type { DesktopIconProps } from './desktopIcon/types';
