/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start Menu tab IDs + P19 search-first normalization (`categories` → `all`).
 *
 * Invariants:
 * - `categories` remains a deep-link alias only; runtime UI uses `home` / `all`.
 * - Default open tab is `home`.
 *
 * Related:
 * - components/startMenu/StartMenuTabStrip.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

/** Tabs in Start Menu (desktop shell). */
export type StartMenuTab =
	| 'home'
	| 'all'
	| 'recent'
	| 'work'
	| 'pinned'
	/** @deprecated Deep-link alias — resolve via {@link resolveStartMenuTab}. */
	| 'categories';

/** Runtime tabs after alias resolution (never `categories`). */
export type StartMenuResolvedTab = Exclude<StartMenuTab, 'categories'>;

export function resolveStartMenuTab(tab: StartMenuTab): StartMenuResolvedTab {
	return tab === 'categories' ? 'all' : tab;
}

export function isStartMenuTab(value: unknown): value is StartMenuTab {
	return (
		value === 'home' ||
		value === 'all' ||
		value === 'recent' ||
		value === 'work' ||
		value === 'pinned' ||
		value === 'categories'
	);
}

/** Short lists on Home (Find) — progressive disclosure, not the full catalog. */
export const START_MENU_HOME_SHORT_LIST_CAP = 6;

/** Idle Recent MRU grid — same progressive cap as Home short lists (Wave 1). */
export const START_MENU_RECENT_MRU_CAP = START_MENU_HOME_SHORT_LIST_CAP;

/** Collapsed Recent library preview rows before “Show library”. */
export const START_MENU_RECENT_LIBRARY_PREVIEW_CAP = 3;

/** Expanded “recommended for space” chips — below catalog-wall density. */
export const START_MENU_RECENT_RECOMMENDED_CAP = 8;

export type { DesktopMenuMode } from '../../../types/profile';
export {
	DESKTOP_MENU_MODE_KEYS,
	normalizeDesktopMenuMode,
} from '../../../types/profile';
