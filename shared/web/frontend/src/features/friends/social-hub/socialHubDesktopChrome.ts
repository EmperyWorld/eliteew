/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop chrome labels for Social Hub (icon, window title) aligned with in-app product title.
 *
 * Invariants:
 * - `app-social-hub` / `SocialHubApp` only; does not change appComponent or ids.
 * - User-customized icon labels (name not in legacy set) are preserved.
 *
 * Related:
 * - documentation/product/SOCIAL-HUB-UI-COPY-2026-05.md
 * - pages/Desktop/utils/desktopDefaultAppUserFacingCopy.ts
 */

import type { DesktopItem } from '@/pages/Desktop/types/desktop.types';

export const SOCIAL_HUB_DESKTOP_APP_ID = 'app-social-hub';

const SOCIAL_HUB_APP_COMPONENTS = new Set(['SocialHubApp', 'FriendsApp']);

/** Legacy desktop/window labels replaced on load (exact match, trimmed). */
export const SOCIAL_HUB_LEGACY_DESKTOP_NAMES = [
	'Social hub',
	'Social Hub',
	'Друзья',
	'Friends',
	'Профиль',
	'User Profile',
	'Friends & profile',
	'Друзья и профиль',
] as const;

export function isSocialHubDesktopItem(item: DesktopItem): boolean {
	return (
		item.type === 'app' &&
		(item.id === SOCIAL_HUB_DESKTOP_APP_ID ||
			(item.appComponent != null &&
				SOCIAL_HUB_APP_COMPONENTS.has(item.appComponent)))
	);
}

function isCanonicalSocialHubDesktopName(name: string): boolean {
	const trimmed = name.trim();
	return trimmed === 'Связи' || trimmed === 'Connections';
}

export function withSocialHubDesktopItemsDisplayName(
	items: readonly DesktopItem[],
	labels: { name: string; description?: string }
): DesktopItem[] {
	let changed = false;
	const next = items.map((item) => {
		if (!isSocialHubDesktopItem(item)) {
			return item;
		}
		const trimmedName = item.name.trim();
		const isLegacy = (
			SOCIAL_HUB_LEGACY_DESKTOP_NAMES as readonly string[]
		).includes(trimmedName);
		const userRenamed =
			!isLegacy &&
			!isCanonicalSocialHubDesktopName(trimmedName) &&
			trimmedName.length > 0;
		if (userRenamed) {
			return item;
		}
		const nextDescription = labels.description ?? item.description;
		if (item.name === labels.name && nextDescription === item.description) {
			return item;
		}
		changed = true;
		return {
			...item,
			name: labels.name,
			description: nextDescription,
		};
	});
	return changed ? next : (items as DesktopItem[]);
}
