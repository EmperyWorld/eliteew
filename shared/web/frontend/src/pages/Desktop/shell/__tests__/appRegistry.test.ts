/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Shell App Registry seed + window-body scroll resolution (U1.a).
 *
 * Invariants:
 * - Self-scroll membership matches former DESKTOP_APP_WINDOW_BODY_SELF_SCROLL inventory.
 * - ContentManagerPro = outer_preview; iframe launchers = outer; Settings has scrollContainerId.
 *
 * Related:
 * - ../appRegistry.ts
 * - ../shellScroll.ts
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	assertShellAppRegistered,
	getShellAppRegistration,
	isShellAppSelfScroll,
	listShellAppRegistrations,
	resolveWindowBodyScroll,
} from '../appRegistry';
import {
	__resetAndReseedShellAppCatalogForTests,
	SHELL_APP_SELF_SCROLL_IDS,
} from '../appRegistry.catalog';
import { resolveWindowBodyScrollDomFlags } from '../shellScroll';

const EXPECTED_SELF_SCROLL_APPS = [
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

const INTENTIONAL_OUTER_SCROLL_APPS = [
	'ContentManagerPro',
	'DesktopAppMaintenance',
	'EmperyNexusChronicleApp',
	'LocalServiceIframeApp',
	'ProjectAboutApp',
	'VideoCallApp',
] as const;

describe('shell appRegistry (U1.a)', () => {
	beforeEach(() => {
		__resetAndReseedShellAppCatalogForTests();
	});

	it('seeds every audited self-scroll app as mode self', () => {
		expect(SHELL_APP_SELF_SCROLL_IDS).toEqual([...EXPECTED_SELF_SCROLL_APPS]);
		expect(
			listShellAppRegistrations().filter((r) => r.scroll.mode === 'self')
		).toHaveLength(EXPECTED_SELF_SCROLL_APPS.length);

		for (const app of EXPECTED_SELF_SCROLL_APPS) {
			expect(resolveWindowBodyScroll('app', app).mode).toBe('self');
			expect(isShellAppSelfScroll('app', app)).toBe(true);
			assertShellAppRegistered(app);
		}
	});

	it('registers ContentManagerPro as outer_preview and iframe apps as outer', () => {
		expect(resolveWindowBodyScroll('app', 'ContentManagerPro')).toEqual({
			mode: 'outer_preview',
			scrollContainerId: undefined,
		});
		expect(getShellAppRegistration('ContentManagerPro')?.scroll.mode).toBe(
			'outer_preview'
		);

		for (const app of INTENTIONAL_OUTER_SCROLL_APPS) {
			if (app === 'ContentManagerPro') continue;
			expect(resolveWindowBodyScroll('app', app).mode).toBe('outer');
			expect(getShellAppRegistration(app)?.chromeProfile).toBe(
				'iframe_launcher'
			);
			expect(isShellAppSelfScroll('app', app)).toBe(false);
		}
	});

	it('declares Settings scrollContainerId and settings chrome profile', () => {
		const reg = getShellAppRegistration('DesktopShellSettings');
		expect(reg?.scroll).toEqual({
			mode: 'self',
			scrollContainerId: 'desktop-settings-main-tabpanel',
		});
		expect(reg?.chromeProfile).toBe('settings');
		expect(resolveWindowBodyScroll('app', 'DesktopShellSettings')).toEqual({
			mode: 'self',
			scrollContainerId: 'desktop-settings-main-tabpanel',
		});
	});

	it('exposes chromeProfile for EnhancedWindow data-shell-chrome-profile (U4)', () => {
		expect(getShellAppRegistration('DesktopShellSettings')?.chromeProfile).toBe(
			'settings'
		);
		expect(getShellAppRegistration('VideoCallApp')?.chromeProfile).toBe(
			'iframe_launcher'
		);
		expect(getShellAppRegistration('StudioGU')?.chromeProfile).toBe('standard');
	});

	it('forces outer scroll for non-app window types and unknown apps', () => {
		expect(resolveWindowBodyScroll('folder', 'UserSiteStudio')).toEqual({
			mode: 'outer',
		});
		expect(isShellAppSelfScroll('folder', 'UserSiteStudio')).toBe(false);
		expect(resolveWindowBodyScroll('app', 'TotallyUnknownApp')).toEqual({
			mode: 'outer',
		});
		expect(isShellAppSelfScroll('app', null)).toBe(false);
	});
});

describe('shellScroll DomFlags (U1.a)', () => {
	beforeEach(() => {
		__resetAndReseedShellAppCatalogForTests();
	});

	it('maps self → overflow-hidden without data-desktop-scroll', () => {
		expect(resolveWindowBodyScrollDomFlags('app', 'StudioGU')).toEqual({
			mode: 'self',
			scrollContainerId: undefined,
			overflowClassName: 'overflow-hidden',
			dataDesktopScroll: undefined,
		});
	});

	it('maps outer / outer_preview → overflow-auto + data-desktop-scroll', () => {
		expect(resolveWindowBodyScrollDomFlags('app', 'VideoCallApp')).toEqual({
			mode: 'outer',
			scrollContainerId: undefined,
			overflowClassName: 'overflow-auto',
			dataDesktopScroll: 'true',
		});
		expect(resolveWindowBodyScrollDomFlags('app', 'ContentManagerPro')).toEqual(
			{
				mode: 'outer_preview',
				scrollContainerId: undefined,
				overflowClassName: 'overflow-auto',
				dataDesktopScroll: 'true',
			}
		);
	});

	it('exposes Settings scrollContainerId on DomFlags', () => {
		expect(
			resolveWindowBodyScrollDomFlags('app', 'DesktopShellSettings')
		).toMatchObject({
			mode: 'self',
			scrollContainerId: 'desktop-settings-main-tabpanel',
			overflowClassName: 'overflow-hidden',
			dataDesktopScroll: undefined,
		});
	});
});
