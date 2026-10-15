/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public barrel for the desktop visual system — re-exports only; implementation lives in desktopVisualSystem/*.
 *
 * Invariants:
 * - App component visual identities remain stable for persisted desktop items.
 * - Every DesktopWindowStyle key keeps a distinct premium look; no backdrop-filter / chameleon motion.
 * - No infinite CSS animation on window, taskbar, or widget chrome.
 * - Chrome gradient tokens (`--desktop-chrome-*-bg`) use `[background-image:var(--…)]`,
 *   never Tailwind `bg-(--…)` (that emits `background-color`, which drops gradients).
 *
 * Related:
 * - `pages/Desktop/utils/desktopVisualSystem.tsx` (public barrel)
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
export { DESKTOP_SHARED_CHROME_PRIMITIVES } from './desktopVisualSystem/sharedChromePrimitives';
export {
	DESKTOP_FLAT_TASKBAR,
	DESKTOP_TASKBAR_STYLE_PRESETS,
	TASKBAR_PANEL_OPACITY_OVERLAY_WEIGHT,
} from './desktopVisualSystem/taskbarPresets';
export {
	type DesktopWindowShellTier,
	DESKTOP_FLAT_SHELL,
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopWindowShellTier,
} from './desktopVisualSystem/windowFramePresets';
export {
	DESKTOP_ICON_SURFACE_STYLES,
	getDesktopIconSurfaceClasses,
} from './desktopVisualSystem/iconSurfacePresets';
export {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	type DesktopShellPanelStrength,
	getDesktopNativeSelectControlClassName,
	getDesktopShellCheckboxControlClassName,
	getDesktopShellContentPanelClassName,
	getDesktopShellContextMenuClassName,
	getDesktopShellEastColumnClassName,
	getDesktopShellEmbeddedAppRootClassName,
	getDesktopShellFileCardMetaClassName,
	getDesktopShellFileCardRootIdleClassName,
	getDesktopShellFileCardThumbClassName,
	getDesktopShellFloatingSurfaceClassName,
	getDesktopShellFooterStripClassName,
	getDesktopShellFormSelectClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellNavRailClassName,
	getDesktopShellPanelClassName,
	getDesktopShellProgressTrackClassName,
	getDesktopShellSelectListOptionInteractiveClassName,
	getDesktopShellSettingsFormCardClassName,
	getDesktopShellSettingsMainColumnClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
	getDesktopWidgetRootClassName,
	getGafChatOverflowMenuSurfaceClassName,
} from './desktopVisualSystem/shellChromeClasses';
export { DESKTOP_WINDOW_TITLEBAR_STYLES } from './desktopVisualSystem/titlebarPresets';
export type { DesktopAppGlyphIcon } from './desktopVisualSystem/appGlyphMap';
export { DesktopAppSymbol } from './desktopVisualSystem/DesktopAppSymbol';
export {
	type DesktopFolderSymbolProps,
	DesktopFolderSymbol,
} from './desktopVisualSystem/DesktopFolderSymbol';
export {
	DesktopAppBadge,
	getDesktopAppIconNode,
} from './desktopVisualSystem/DesktopAppBadge';
export { DESKTOP_WORKSPACE_MOTION } from './desktopVisualSystem/workspaceMotion';
