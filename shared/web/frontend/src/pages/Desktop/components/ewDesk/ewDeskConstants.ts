/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared constants for EWDesk client state (DOM ids, localStorage keys, limits, listbox ids).
 *
 * Invariants:
 * - Keys stay stable across releases so offline read/starred markers survive upgrades.
 * - `ewDeskListOptionDomId` must match list row option ids for listbox `aria-activedescendant`.
 *
 * Related:
 * - EWDeskApp.tsx, useEwDeskUserStateSync.ts
 */

export const EW_DESK_DETAIL_PANEL_ID = 'ewdesk-detail-panel';
export const EW_DESK_LISTBOX_ID = 'ewdesk-news-listbox';

export const EW_DESK_READ_IDS_KEY = 'ewdesk-read-post-ids';
export const EW_DESK_STARRED_IDS_KEY = 'ewdesk-starred-post-ids';
export const EW_DESK_READING_WIDTH_KEY = 'ewdesk-reading-width';

export const MAX_EW_DESK_READ_IDS = 400;
export const MAX_EW_DESK_STARRED_IDS = 120;

export const EW_DESK_LIST_SKELETON_STAGGER = [
	'[animation-delay:0ms]',
	'[animation-delay:52ms]',
	'[animation-delay:104ms]',
	'[animation-delay:156ms]',
] as const;

export type EwDeskReadingWidth = 'narrow' | 'comfortable' | 'wide';

/** Minimum unread count before «mark all read» asks for confirmation. */
export const EWDESK_MARK_ALL_READ_CONFIRM_MIN = 5;

export function ewDeskListOptionDomId(postId: string): string {
	return `ewdesk-opt-${postId}`;
}
