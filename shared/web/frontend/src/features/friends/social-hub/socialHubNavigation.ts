/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Social Hub desktop section model and legacy tab id normalization for deep links.
 *
 * Invariants:
 * - Legacy `socialHubTab` values from notifications and sessionStorage map to section + people subview.
 * - `profile` launch hints always land on the privacy section.
 *
 * Related:
 * - SocialHubShell.tsx
 * - pages/Desktop/utils/desktopDeepLink.ts
 */

export type SocialHubSection = 'home' | 'people' | 'privacy' | 'phone';

export type SocialHubPeopleSubview = 'contacts' | 'lists' | 'requests';

/** Legacy tab ids still accepted from API, push, and sessionStorage. */
export type LegacySocialHubTab =
	| 'overview'
	| 'inbox'
	| 'friends'
	| 'circles'
	| 'privacy'
	| 'profile'
	| 'mobile-app';

export const SOCIAL_HUB_SECTIONS: SocialHubSection[] = [
	'home',
	'people',
	'privacy',
	'phone',
];

export type SocialHubNavigationState = {
	section: SocialHubSection;
	peopleSubview: SocialHubPeopleSubview;
};

export function defaultSocialHubNavigation(): SocialHubNavigationState {
	return { section: 'home', peopleSubview: 'contacts' };
}

export function isLegacySocialHubTab(
	value: unknown
): value is LegacySocialHubTab {
	return (
		value === 'overview' ||
		value === 'inbox' ||
		value === 'friends' ||
		value === 'circles' ||
		value === 'privacy' ||
		value === 'profile' ||
		value === 'mobile-app'
	);
}

/** Map legacy tab hint to shell navigation state. */
export function resolveLegacySocialHubTab(
	value: unknown
): SocialHubNavigationState | null {
	if (!isLegacySocialHubTab(value)) {
		return null;
	}
	if (value === 'profile') {
		return { section: 'privacy', peopleSubview: 'contacts' };
	}
	if (value === 'overview') {
		return { section: 'home', peopleSubview: 'contacts' };
	}
	if (value === 'inbox') {
		return { section: 'people', peopleSubview: 'requests' };
	}
	if (value === 'friends') {
		return { section: 'people', peopleSubview: 'contacts' };
	}
	if (value === 'circles') {
		return { section: 'people', peopleSubview: 'lists' };
	}
	if (value === 'privacy') {
		return { section: 'privacy', peopleSubview: 'contacts' };
	}
	if (value === 'mobile-app') {
		return { section: 'phone', peopleSubview: 'contacts' };
	}
	return null;
}

export function sectionOpensPrivacy(section: SocialHubSection): boolean {
	return section === 'privacy';
}

export function sectionOpensPhone(section: SocialHubSection): boolean {
	return section === 'phone';
}

export function peopleDirectorySection(
	subview: SocialHubPeopleSubview
): 'friends' | 'circles' {
	return subview === 'lists' ? 'circles' : 'friends';
}

export function peopleDataActive(
	section: SocialHubSection,
	subview: SocialHubPeopleSubview
): boolean {
	return section === 'people' && subview !== 'requests';
}
