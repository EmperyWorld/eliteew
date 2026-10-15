/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect mobile embedded SPA hash routes (companion, handbook, …) and expose
 * the Wave 4 journey allowlist (hash → product surface).
 *
 * Related:
 * - setupMobileEmbeddedOidcProfile.ts, MobileHandbookPage.tsx, MobileEwaCompanionPage.tsx
 * - utils/desktopFullShellChrome.ts
 * - documentation/product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md
 */

const MOBILE_EMBEDDED_HASH_ROUTES = [
	'mobile-ewa-companion',
	'mobile-handbook',
	'mobile-social-hub',
	'mobile-feedback-hub',
	'mobile-notifications',
	'mobile-content-manager',
	'mobile-ewdesk',
	'mobile-professional-worlds',
	'mobile-app-store',
	'mobile-desktop-settings',
] as const;

export type MobileEmbeddedHashRoute =
	(typeof MOBILE_EMBEDDED_HASH_ROUTES)[number];

/** Living allowlist: hash route → user journey label (Wave 4 embedded shell map). */
export const MOBILE_EMBEDDED_JOURNEY_MAP: ReadonlyArray<{
	route: MobileEmbeddedHashRoute;
	journey: string;
	hidesFullShellChrome: true;
}> = [
	{
		route: 'mobile-ewa-companion',
		journey: 'Assistant chat',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-handbook',
		journey: 'Assistant / docs reader',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-social-hub',
		journey: 'Social Hub',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-feedback-hub',
		journey: 'Feedback Hub',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-notifications',
		journey: 'Notifications center',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-content-manager',
		journey: 'Файловый менеджер',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-ewdesk',
		journey: 'EWDesk',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-professional-worlds',
		journey: 'Professional Worlds',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-app-store',
		journey: 'App Store',
		hidesFullShellChrome: true,
	},
	{
		route: 'mobile-desktop-settings',
		journey: 'Desktop Settings Center (embedded panel only)',
		hidesFullShellChrome: true,
	},
] as const;

/** Frozen copy of hash allowlist for Vitest / docs sync. */
export function listMobileEmbeddedHashRoutes(): readonly MobileEmbeddedHashRoute[] {
	return MOBILE_EMBEDDED_HASH_ROUTES;
}
function normalizeHashPage(hash: string): string {
	return hash.replace(/^#/, '').split('?')[0]?.replace(/^\/+/, '').trim() ?? '';
}

export function resolveMobileEmbeddedHashRoute(): MobileEmbeddedHashRoute | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const page = normalizeHashPage(window.location.hash);
	return MOBILE_EMBEDDED_HASH_ROUTES.includes(page as MobileEmbeddedHashRoute)
		? (page as MobileEmbeddedHashRoute)
		: null;
}

export function isMobileHandbookEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-handbook';
}

export function isMobileEwaCompanionEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-ewa-companion';
}

export function isMobileSocialHubEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-social-hub';
}

export function isMobileFeedbackHubEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-feedback-hub';
}

export function isMobileNotificationsEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-notifications';
}

export function isMobileContentManagerEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-content-manager';
}

export function isMobileEwDeskEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-ewdesk';
}

export function isMobileProfessionalWorldsEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-professional-worlds';
}

export function isMobileAppStoreEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-app-store';
}

export function isMobileDesktopSettingsEmbeddedRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() === 'mobile-desktop-settings';
}

export function isMobileEmbeddedSpaRoute(): boolean {
	return resolveMobileEmbeddedHashRoute() !== null;
}
