/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for shared Desktop app chrome primitives.
 * Implementation lives in `./desktopAppChrome/*` (P28 atomization).
 *
 * Invariants:
 * - All public symbols remain importable from this path (zero consumer changes).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

export {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_APP_FAMILY_BY_COMPONENT,
	getDesktopAppFamily,
	getDesktopAppSurfaceMode,
} from './desktopAppChrome/styleContract';
export type {
	DesktopAppFamily,
	DesktopAppSurfaceMode,
} from './desktopAppChrome/styleContract';

export {
	DesktopAppSurface,
	DesktopAppPanel,
	DesktopAppToolbar,
} from './desktopAppChrome/surfaces';

export {
	DesktopProductWorkspace,
	DesktopProductHeader,
	DesktopProductStatusBanner,
	DesktopProductStatePanel,
	DesktopProductNextAction,
} from './desktopAppChrome/productWorkspace';
export type {
	DesktopProductWorkspaceProps,
	DesktopProductHeaderProps,
	DesktopProductStatusTone,
	DesktopProductStatusBannerProps,
	DesktopProductStatePanelProps,
	DesktopProductNextActionProps,
} from './desktopAppChrome/productWorkspace';

export {
	DesktopAppSectionLabel,
	DesktopAppButton,
	DesktopAppInput,
	DesktopNativeSelect,
	DesktopAppListRow,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from './desktopAppChrome/controls';

export {
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
	DesktopAppContentWrapper,
} from './desktopAppChrome/states';

export {
	DesktopAppModalFrame,
	DesktopPortaledConfirmShell,
} from './desktopAppChrome/modal';
export type { DesktopPortaledConfirmShellProps } from './desktopAppChrome/modal';

export {
	menuItemVariants,
	DesktopAppMenuSurface,
	DesktopAppMenuHeader,
	DesktopAppMenuSectionLabel,
	DesktopAppContextMenuTitle,
	DesktopAppMenuItem,
	DesktopAppMenuDivider,
} from './desktopAppChrome/menu';
export type { DesktopAppMenuHeaderProps } from './desktopAppChrome/menu';
