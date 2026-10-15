/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lock K2–K10 Kernel-offline mount policy (shared SoT + spa_offline_only).
 */

import { describe, expect, it } from 'vitest';
import {
	buildKernelOfflineMountUrl,
	buildSpaDeepLinkStartUrl,
	isPresentationUrlMount,
	isSpaDeepLinkMount,
	kernelOfflineCatalogHint,
	presentationUrlMountIds,
	SPA_OPEN_APP_QUERY,
	spaDeepLinkMountIds,
	offlineSpaSubsetMountIds,
	isOfflineSpaSubsetMount,
} from './kernelOfflineMount';

describe('kernelOfflineMount policy K2–K6', () => {
	it('builds ProjectAbout presentation URL from policy path', () => {
		expect(isPresentationUrlMount('ProjectAboutApp')).toBe(true);
		expect(isSpaDeepLinkMount('ProjectAboutApp')).toBe(false);
		expect(
			buildKernelOfflineMountUrl('https://app.eliteew.ru/', 'ProjectAboutApp')
		).toBe('https://app.eliteew.ru/o-proekte/index.html');
	});

	it('keeps other pack apps o5_panel_only with spa_deep_link', () => {
		expect(isPresentationUrlMount('ClipboardManager')).toBe(false);
		expect(isSpaDeepLinkMount('ClipboardManager')).toBe(true);
		expect(
			buildKernelOfflineMountUrl('https://app.eliteew.ru', 'ClipboardManager')
		).toBeNull();
		expect(kernelOfflineCatalogHint('MusicPlayer')).toContain('облачн');
	});

	it('builds spa_deep_link Start URL with eliteewOpenApp', () => {
		const url = buildSpaDeepLinkStartUrl(
			'https://app.eliteew.ru',
			'ClipboardManager'
		);
		expect(url).toBeTruthy();
		const parsed = new URL(url!);
		expect(parsed.searchParams.get('eliteewDesktopClient')).toBe('1');
		expect(parsed.searchParams.get(SPA_OPEN_APP_QUERY)).toBe('ClipboardManager');
		expect(
			buildSpaDeepLinkStartUrl('https://app.eliteew.ru', 'ProjectAboutApp')
		).toBeNull();
	});

	it('lists presentation, spa_deep_link, and offline subset mounts (K10+)', () => {
		expect(presentationUrlMountIds()).toEqual(['ProjectAboutApp']);
		expect(spaDeepLinkMountIds()).toEqual([
			'ClipboardManager',
			'MusicPlayer',
			'NotificationsApp',
		]);
		expect(offlineSpaSubsetMountIds()).toEqual([
			'AssistantApp',
			'ClipboardManager',
			'DesktopAppMaintenance',
			'DesktopDashboardFavoritesApp',
			'DesktopShellSettings',
			'DesktopWidgetShelfApp',
			'DocEditor',
			'DocEditorV2',
			'EmperyNexusChronicleApp',
			'MusicPlayer',
			'NotificationsApp',
			'PoemmaApp',
			'Presentations',
			'PresentationsArchive',
			'ProjectAboutApp',
		]);
		expect(isOfflineSpaSubsetMount('MusicPlayer')).toBe(true);
		expect(isOfflineSpaSubsetMount('DocEditor')).toBe(true);
		expect(isOfflineSpaSubsetMount('DocEditorV2')).toBe(true);
		expect(isOfflineSpaSubsetMount('Presentations')).toBe(true);
		expect(isOfflineSpaSubsetMount('PresentationsArchive')).toBe(true);
		expect(isOfflineSpaSubsetMount('EmperyNexusChronicleApp')).toBe(true);
		expect(isOfflineSpaSubsetMount('PoemmaApp')).toBe(true);
		expect(isOfflineSpaSubsetMount('AssistantApp')).toBe(true);
		expect(isOfflineSpaSubsetMount('DesktopAppMaintenance')).toBe(true);
	});
});
