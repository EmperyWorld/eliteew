/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop icon grid geometry, size preferences, and app icon tile chrome.
 *
 * Invariants:
 * - Symbol names and values unchanged from pre-P38 constants barrel; structural split only.
 *
 * Related:
 * - constants/index.ts (re-export barrel)
 * - src/pages/Desktop/utils/desktopAppRegistry.ts
 */
import { DESKTOP_ICON_SVG_QUALITY } from './lucideDesktop';

/** Desktop icon grid: one canonical source for snap and collision */
export const DESKTOP_GRID = {
	GRID_SIZE: 110,
	OFFSET: 20,
	ICON_WIDTH: 100,
	ICON_HEIGHT: 110,
	/** Max position so icons stay within reasonable desktop area (min = OFFSET, used in desktopGrid) */
	MAX_X: 4000,
	MAX_Y: 4000,
} as const;

/** Grid step options for align-to-grid (configurable step) */
export type GridStepPreference = 'small' | 'medium' | 'large';
export const DESKTOP_GRID_STEPS: Record<GridStepPreference, number> = {
	small: 70,
	medium: 95,
	large: 125,
};

/** User preference for desktop icon size */
export type IconSizePreference = 'small' | 'medium' | 'large';

/** Icon dimensions and classes per config icon_size (slightly more compact, premium labels) */
export const DESKTOP_ICON_SIZES: Record<
	IconSizePreference,
	{ width: number; height: number; iconBox: string; label: string }
> = {
	small: {
		width: 80,
		height: 90,
		iconBox: 'w-9 h-9',
		label: 'w-full max-w-[72px] text-[10px] tracking-[0.02em]',
	},
	medium: {
		width: 100,
		height: 110,
		iconBox: 'w-11 h-11',
		label: 'w-full max-w-[88px] text-[11px] tracking-[0.02em]',
	},
	large: {
		width: 120,
		height: 130,
		iconBox: 'w-13 h-13',
		label: 'w-full max-w-[104px] text-sm tracking-[0.02em]',
	},
};

/**
 * Premium opaque tile for app icons across Desktop (desktop grid, Start Menu, pinned menus).
 * Container: solid shell tile; Inner: centers SVG with depth shadow (no backdrop-filter).
 */
export const DESKTOP_APP_ICON = {
	container:
		'flex items-center justify-center rounded-[1.05rem] border border-[var(--desktop-border-subtle)] bg-[linear-gradient(152deg,rgb(39,39,42)_0%,rgb(24,24,27)_48%,rgb(9,9,11)_100%)] shadow-[0_22px_52px_rgba(0,0,0,0.48)] overflow-hidden ring-1 ring-black/20',
	inner: `w-full h-full text-[var(--desktop-text-secondary)] flex items-center justify-center [&>*]:w-full [&>*]:h-full [&>svg]:w-3/4 [&>svg]:h-3/4 ${DESKTOP_ICON_SVG_QUALITY} drop-shadow-[0_5px_14px_rgba(0,0,0,0.42)]`,
} as const;

/** Icon sizes for panels and menus: use for Taskbar, StartMenu, context menus */
export const DESKTOP_ICON_SIZES_PANEL = {
	/** List items, menu items */
	menu: `w-4 h-4 shrink-0 ${DESKTOP_ICON_SVG_QUALITY}`,
	/** Toolbar / large buttons */
	button: `w-5 h-5 shrink-0 ${DESKTOP_ICON_SVG_QUALITY}`,
	/** Small inline (badges, meta) */
	small: `w-3.5 h-3.5 shrink-0 ${DESKTOP_ICON_SVG_QUALITY}`,
} as const;
