/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Seed Shell App Registry from the audited self-scroll / outer-scroll inventory (U1.a).
 * Import this module once from shell barrel so EnhancedWindow resolution sees entries.
 *
 * Invariants:
 * - Self-scroll membership matches former DESKTOP_APP_WINDOW_BODY_SELF_SCROLL.
 * - ContentManagerPro is outer_preview; iframe launchers are outer + iframe_launcher.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md §6 U1.a
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 */

import {
	__resetShellAppCatalogForTests,
	registerDesktopShellApp,
	type ShellAppRegistration,
} from './appRegistry';

const SELF_SCROLL_APPS = [
	'AppStore',
	'AssistantApp',
	'CalendarApp',
	'ClipboardManager',
	'CustomerCabinet',
	'DesktopAiChatApp',
	'DesktopDashboardFavoritesApp',
	'DesktopShellSettings',
	'DesktopWidgetShelfApp',
	'DocEditor',
	'DocEditorV2',
	'EWDeskApp',
	'EBrowserApp',
	'EWRP',
	'EwaApp',
	'FeedbackHubApp',
	'FriendsApp',
	'GAFChatApp',
	'ImageStudio',
	'KirsClientSite',
	'KirsCuration',
	'KursorinaApp',
	'MarketingCabinet',
	'MusicEvolutionApp',
	'MusicForgeApp',
	'MusicGenerator',
	'MusicPlayer',
	'NotificationsApp',
	'PoemmaApp',
	'Presentations',
	'PresentationsArchive',
	'ProfessionalWorlds',
	'SiteManagerOps',
	'SocialHubApp',
	'StudioGU',
	'SurveyHubApp',
	'UGS',
	'UGSHubApp',
	'UnifiedAdminApp',
	'UserProfile',
	'UserSiteStudio',
	'VideoStudio',
] as const;

const IFRAME_OUTER_APPS = [
	'DesktopAppMaintenance',
	'EmperyNexusChronicleApp',
	'LocalServiceIframeApp',
	'ProjectAboutApp',
	'VideoCallApp',
] as const;

function selfScrollReg(
	appComponent: string,
	extra?: Partial<ShellAppRegistration>
): ShellAppRegistration {
	return {
		appComponent,
		scroll: { mode: 'self', ...extra?.scroll },
		portal: {
			policy: 'optional',
			defaultLayer: 'embedded_popover',
			...extra?.portal,
		},
		chromeProfile: extra?.chromeProfile ?? 'standard',
		notes: extra?.notes,
	};
}

let seeded = false;

/** Idempotent seed — safe if barrel imports catalog more than once. */
export function ensureShellAppCatalogSeeded(): void {
	if (seeded) return;
	seeded = true;

	for (const app of SELF_SCROLL_APPS) {
		if (app === 'DesktopShellSettings') {
			registerDesktopShellApp(
				selfScrollReg(app, {
					scroll: {
						mode: 'self',
						scrollContainerId: 'desktop-settings-main-tabpanel',
					},
					chromeProfile: 'settings',
					notes: 'Settings Center tabpanel owns vertical scroll',
				})
			);
			continue;
		}
		registerDesktopShellApp(selfScrollReg(app));
	}

	registerDesktopShellApp({
		appComponent: 'ContentManagerPro',
		scroll: { mode: 'outer_preview' },
		portal: { policy: 'optional', defaultLayer: 'embedded_popover' },
		chromeProfile: 'standard',
		notes: 'Outer data-desktop-scroll hosts preview geometry',
	});

	for (const app of IFRAME_OUTER_APPS) {
		registerDesktopShellApp({
			appComponent: app,
			scroll: { mode: 'outer' },
			portal: { policy: 'forbidden', defaultLayer: 'shell_global' },
			chromeProfile: 'iframe_launcher',
		});
	}
}

ensureShellAppCatalogSeeded();

/** Exported for parity tests with legacy Set. */
export const SHELL_APP_SELF_SCROLL_IDS: readonly string[] = SELF_SCROLL_APPS;

/** Test helper: clear map and re-apply U1.a seed. */
export function __resetAndReseedShellAppCatalogForTests(): void {
	__resetShellAppCatalogForTests();
	seeded = false;
	ensureShellAppCatalogSeeded();
}
