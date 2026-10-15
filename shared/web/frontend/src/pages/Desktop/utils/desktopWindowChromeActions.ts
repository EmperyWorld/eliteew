/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared window chrome ПКМ action IDs used by workspace window menu and taskbar
 * window-button menu — reduces drift when adding restore / minimize / maximize / close.
 *
 * Invariants:
 * - IDs are stable English tokens; labels come from i18n at the call site.
 * - Taskbar subset is a strict subset of workspace chrome actions.
 *
 * Related:
 * - DesktopWorkspaceWindowContextMenu.tsx
 * - TaskbarShellContextMenus.tsx
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */

/** Actions shared by taskbar window button menu and workspace window chrome menu. */
export const DESKTOP_WINDOW_CHROME_SHARED_ACTIONS = [
	'restore-or-focus',
	'minimize',
	'maximize-or-restore',
	'close',
	'move-to-desktop',
] as const;

export type DesktopWindowChromeSharedAction =
	(typeof DESKTOP_WINDOW_CHROME_SHARED_ACTIONS)[number];

/** Extended workspace-only chrome actions (not on taskbar subset menu). */
export const DESKTOP_WINDOW_CHROME_WORKSPACE_EXTRA_ACTIONS = [
	'bring-to-front',
	'always-on-top',
	'duplicate',
	'snap',
	'bring-into-work-area',
	'shell-settings',
	'assistant',
] as const;

export type DesktopWindowChromeWorkspaceExtraAction =
	(typeof DESKTOP_WINDOW_CHROME_WORKSPACE_EXTRA_ACTIONS)[number];

export type DesktopWindowChromeAction =
	| DesktopWindowChromeSharedAction
	| DesktopWindowChromeWorkspaceExtraAction;

export function isDesktopWindowChromeSharedAction(
	value: string
): value is DesktopWindowChromeSharedAction {
	return (DESKTOP_WINDOW_CHROME_SHARED_ACTIONS as readonly string[]).includes(
		value
	);
}
