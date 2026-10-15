/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell routes that allow only one active browser tab per user (desktop + admin hub).
 *
 * Invariants:
 * - Login, mobile download and other public routes are excluded.
 *
 * Related:
 * - `components/AppRouter.tsx`, `contexts/BrowserTabLeaderProvider.tsx`
 */

import type { ShellPageType } from '@/hooks/useAppState';

const SINGLE_TAB_PAGES: ReadonlySet<ShellPageType> = new Set([
	'desktop',
	'desktop/store',
	'desktop-admin',
	'admin',
]);

export function requiresSingleBrowserTab(page: ShellPageType): boolean {
	return SINGLE_TAB_PAGES.has(page);
}
