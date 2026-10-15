/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build shareable desktop URLs that open EWDesk on a specific post (`?ewdesk_news=`).
 *
 * Invariants:
 * - Query param name matches `useDesktopUrlLaunchEffects` (`ewdesk_news`).
 *
 * Related:
 * - EWDeskApp.tsx, useDesktopUrlLaunchEffects.ts
 */

export type EwDeskDeepLinkLocation = {
	origin: string;
	pathname: string;
};

export function buildEwDeskNewsDeepLink(
	postId: string,
	location: EwDeskDeepLinkLocation = {
		origin: 'https://app.example',
		pathname: '/desktop',
	}
): string {
	const trimmed = postId.trim();
	if (!trimmed) return location.origin + location.pathname;
	const url = new URL(location.pathname, location.origin);
	url.searchParams.set('ewdesk_news', trimmed);
	return url.toString();
}
