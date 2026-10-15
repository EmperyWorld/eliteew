/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export barrel for desktop constants; implementation lives in sibling modules.
 *
 * Invariants:
 * - Default app ids and appComponent names are stable once migrations reference them.
 * - Domain app data stays outside desktop_configs.shell_state.
 * - Consumer import paths stay `constants` / `constants/index` (no path churn).
 *
 * Related:
 * - constants/defaultApps.ts, desktopChromeTokens.ts, desktopZIndex.ts, …
 * - src/pages/Desktop/utils/desktopAppRegistry.ts
 */

export {
	builtinDesktopWallpaperPath,
	DEFAULT_DESKTOP_WALLPAPER_STYLE,
	DESKTOP_WALLPAPER_PUBLIC_BASE,
	isBuiltInWallpaperStyle,
	WALLPAPER_COUNT,
	WALLPAPERS,
} from './wallpapers';

export {
	DESKTOP_DEFAULT_ACCENT_RGB,
	DESKTOP_DESIGN_TOKENS,
} from './desktopDesignTokens';

export { DESKTOP_ICON_SVG_QUALITY, DESKTOP_LUCIDE } from './lucideDesktop';

export {
	ACCENT_COLORS,
	FOLDER_COLORS,
} from './folderAndAccentColors';

export {
	DEFAULT_APPS,
	DEFAULT_FOLDERS,
	DESKTOP_APP_CATEGORY_ORDER,
	isPersistentDesktopApp,
	PERSISTENT_APP_COMPONENTS,
} from './defaultApps';

export {
	DESKTOP_APP_ICON,
	DESKTOP_GRID,
	DESKTOP_GRID_STEPS,
	DESKTOP_ICON_SIZES,
	DESKTOP_ICON_SIZES_PANEL,
	type GridStepPreference,
	type IconSizePreference,
} from './desktopGridAndIcons';

export {
	DESKTOP_CMDK_INJECTED,
	DESKTOP_FLOATING_WIDGET_POSITION_SEED,
	DESKTOP_FLOATING_WIDGET_VIEWPORT_SIZE,
	DESKTOP_INTERACTIVE,
	DESKTOP_LAYOUT,
	DESKTOP_OVERLAY,
	DESKTOP_SHELL_FLYOUT,
	DESKTOP_SURFACE,
	DESKTOP_TOOLTIP,
	DESKTOP_TYPOGRAPHY,
	TASKBAR,
	WINDOW_TITLE_BAR,
} from './desktopChromeTokens';

export {
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_Z_INDEX,
	desktopEmbeddedFloatingMenuZIndex,
} from './desktopZIndex';

export {
	API_ENDPOINTS,
	DESKTOP_API_BASE,
	DESKTOP_FEATURE_FLAGS,
	DESKTOP_PERFORMANCE_TARGETS,
	DESKTOP_POLLING,
	DESKTOP_STYLE_GOVERNANCE,
	STORAGE_KEYS,
} from './desktopRuntimeConfig';
