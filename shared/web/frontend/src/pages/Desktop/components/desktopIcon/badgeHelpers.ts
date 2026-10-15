/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App-component predicates for unread badge chrome variants on desktop icons.
 *
 * Invariants:
 * - Friends/SocialHub and GAFChat badges use distinct gradient styles in DesktopIconSurface.
 *
 * Related:
 * - desktopIcon/DesktopIconSurface.tsx
 */

export function isFriendsAppBadge(appComponent?: string | null): boolean {
	return appComponent === 'FriendsApp' || appComponent === 'SocialHubApp';
}

export function isGafChatAppBadge(appComponent?: string | null): boolean {
	return appComponent === 'GAFChatApp';
}
