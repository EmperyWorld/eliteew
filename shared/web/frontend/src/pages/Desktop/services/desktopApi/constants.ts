/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared desktop user API path constants and axios/fetch option bundles.
 *
 * Invariants:
 * - Desktop base URL segment is **`/api/v1/desktop`** (`DESKTOP_USER_API_PREFIX`).
 *
 * Related:
 * - `shared/api/routers/desktop.py`
 * - `services/desktopApi.ts`
 */

/** Canonical v1 mount (`shared/api/domains/desktop.py`). */
export const DESKTOP_API_V1_BASE = '/api/v1' as const;
/** User desktop router segment (`shared/api/routers/desktop.py` prefix `/desktop`). */
export const DESKTOP_USER_API_PREFIX = '/desktop' as const;

export const SHELL_STATE_CONFLICT_MESSAGE =
	'Desktop shell state changed in another session';

/** Use baseURL so requests hit /api/v1/desktop/* */
export const DESKTOP_API_OPTIONS = { baseURL: DESKTOP_API_V1_BASE };
export const API_PATH = DESKTOP_USER_API_PREFIX;

export const SHELL_STATE_FIELD_ETAGS_HEADER = 'x-shell-state-field-etags';
export const SHELL_STATE_IF_MATCH_FIELDS_HEADER =
	'X-Shell-State-If-Match-Fields';

/** No-cache options for store/installed so refetch after install/uninstall returns fresh data */
export const DESKTOP_STORE_API_OPTIONS = {
	...DESKTOP_API_OPTIONS,
	headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } as Record<
		string,
		string
	>,
};

/** BroadcastChannel name shared with `desktopRealtimeLeader.ts` (`DESKTOP_REALTIME_BC`). */
export const DESKTOP_REALTIME_BC = 'eliteew-desktop-realtime-v1';
