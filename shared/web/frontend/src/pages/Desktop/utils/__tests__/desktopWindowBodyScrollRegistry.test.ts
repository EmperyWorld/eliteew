/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock self-scroll registry membership for declutter scroll ownership.
 *
 * Invariants:
 * - First-party h-full + internal-scroll apps are registered; ContentManagerPro is not.
 * - SocialHub aliases FriendsApp / UserProfile are registered under their own ids.
 *
 * Related:
 * - ../desktopWindowBodyScrollRegistry.ts
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_APP_WINDOW_BODY_SELF_SCROLL,
	isDesktopAppWindowBodySelfScrollApp,
} from '../desktopWindowBodyScrollRegistry';

/** Wave 2026-07-24: apps audited as h-full + internal scroll (same StudioGU chrome-drift class). */
const EXPECTED_SELF_SCROLL_APPS = [
	'AppStore',
	'AssistantApp',
	'ClipboardManager',
	'CustomerCabinet',
	'DesktopAiChatApp',
	'DesktopDashboardFavoritesApp',
	'DesktopShellSettings',
	'DesktopWidgetShelfApp',
	'DocEditor',
	'DocEditorV2',
	'EWDeskApp',
	'EWRP',
	'EwaApp',
	'FeedbackHubApp',
	'FriendsApp',
	'GAFChatApp',
	'ImageStudio',
	'KirsClientSite',
	'KirsCuration',
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

/** Intentionally outer scroll / no React pane scroll — must stay out of registry. */
const INTENTIONAL_OUTER_SCROLL_APPS = [
	'ContentManagerPro',
	'DesktopAppMaintenance',
	'EmperyNexusChronicleApp',
	'LocalServiceIframeApp',
	'ProjectAboutApp',
	'VideoCallApp',
] as const;

describe('desktopWindowBodyScrollRegistry', () => {
	it('registers all audited self-scroll appComponents', () => {
		expect(DESKTOP_APP_WINDOW_BODY_SELF_SCROLL.size).toBe(
			EXPECTED_SELF_SCROLL_APPS.length
		);
		for (const app of EXPECTED_SELF_SCROLL_APPS) {
			expect(isDesktopAppWindowBodySelfScrollApp(app)).toBe(true);
			expect(DESKTOP_APP_WINDOW_BODY_SELF_SCROLL.has(app)).toBe(true);
		}
	});

	it('keeps intentional outer-scroll apps out of the registry', () => {
		for (const app of INTENTIONAL_OUTER_SCROLL_APPS) {
			expect(isDesktopAppWindowBodySelfScrollApp(app)).toBe(false);
		}
	});
});
