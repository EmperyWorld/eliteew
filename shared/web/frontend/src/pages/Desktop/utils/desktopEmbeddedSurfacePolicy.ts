/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared ПКМ policy props for desktop-owned media and iframe host chrome.
 * Parent document can suppress native menu on `<video>`/`<audio>`; iframe
 * *documents* remain a separate browsing context (host attribute is inventory only).
 *
 * Invariants:
 * - Media handlers use policy with stopPropagation false so app menus may still run.
 * - `data-desktop-iframe-host` marks parent chrome around `<iframe>` — not a fix inside the frame.
 *
 * Related:
 * - desktopContextMenuPolicy.ts
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react';
import { applyDesktopContextMenuPolicy } from './desktopContextMenuPolicy';

/** Parent wrapper attribute around desktop `<iframe>` surfaces (inventory + docs). */
export const DESKTOP_IFRAME_HOST_ATTR = 'data-desktop-iframe-host';

/**
 * Suppress native browser menu on desktop media elements (capture deny is belt;
 * element handler helps UA media chrome that bubbles to the media node).
 */
export function onDesktopMediaContextMenu(event: SyntheticEvent | Event): void {
	applyDesktopContextMenuPolicy(event, { stopPropagation: false });
}

/** Spread onto `<video>` / `<audio>` that show browser controls or are ПКМ targets. */
export const desktopMediaContextMenuProps = {
	onContextMenu: (event: ReactMouseEvent<HTMLMediaElement>) => {
		onDesktopMediaContextMenu(event);
	},
} as const;
