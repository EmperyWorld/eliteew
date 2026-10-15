/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lock @eliteew/kernel-offline-policy shared helpers (Wave K8–K16).
 */

import { describe, expect, it } from 'vitest';
import {
	isKernelOfflineSpaDeepLinkAppId,
	isKernelOfflineSpaSubsetAppId,
	KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS,
	KERNEL_OFFLINE_SPA_SUBSET_APP_IDS,
	buildKernelOfflineMountUrl,
	SPA_OPEN_APP_QUERY,
	isSpaOfflineOnlyMount,
	spaOfflineOnlyMountIds,
	kernelOfflineSubsetBreakdown,
	formatKernelOfflineSubsetNoticeRu,
	kernelOfflineLabelRu,
} from '../src/index';

describe('@eliteew/kernel-offline-policy', () => {
	it('exports stable open-app query key', () => {
		expect(SPA_OPEN_APP_QUERY).toBe('eliteewOpenApp');
	});

	it('lists spa_deep_link and offline_spa_subset from shared SoT', () => {
		expect(KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS).toEqual([
			'ClipboardManager',
			'MusicPlayer',
			'NotificationsApp',
		]);
		expect(KERNEL_OFFLINE_SPA_SUBSET_APP_IDS).toEqual([
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
	});

	it('lists spa_offline_only beyond O5 pack (K10–K16)', () => {
		expect(isSpaOfflineOnlyMount('DocEditor')).toBe(true);
		expect(isSpaOfflineOnlyMount('DocEditorV2')).toBe(true);
		expect(isSpaOfflineOnlyMount('Presentations')).toBe(true);
		expect(isSpaOfflineOnlyMount('PresentationsArchive')).toBe(true);
		expect(isSpaOfflineOnlyMount('EmperyNexusChronicleApp')).toBe(true);
		expect(isSpaOfflineOnlyMount('PoemmaApp')).toBe(true);
		expect(isSpaOfflineOnlyMount('DesktopShellSettings')).toBe(true);
		expect(isSpaOfflineOnlyMount('DesktopAppMaintenance')).toBe(true);
		expect(isSpaOfflineOnlyMount('ClipboardManager')).toBe(false);
		expect(spaOfflineOnlyMountIds()).toEqual([
			'DesktopAppMaintenance',
			'DesktopDashboardFavoritesApp',
			'DesktopShellSettings',
			'DesktopWidgetShelfApp',
			'DocEditor',
			'DocEditorV2',
			'EmperyNexusChronicleApp',
			'PoemmaApp',
			'Presentations',
			'PresentationsArchive',
		]);
		expect(isKernelOfflineSpaSubsetAppId('Presentations')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('EmperyNexusChronicleApp')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('PoemmaApp')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('DesktopAppMaintenance')).toBe(true);
	});

	it('builds presentation URL for ProjectAbout', () => {
		expect(isKernelOfflineSpaDeepLinkAppId('ProjectAboutApp')).toBe(false);
		expect(isKernelOfflineSpaSubsetAppId('ProjectAboutApp')).toBe(true);
		expect(
			buildKernelOfflineMountUrl('https://app.eliteew.ru/', 'ProjectAboutApp')
		).toBe('https://app.eliteew.ru/o-proekte/index.html');
	});

	it('breaks down O5 pack vs spa_offline_only with K16 user labels', () => {
		const breakdown = kernelOfflineSubsetBreakdown();
		expect(breakdown).toMatchObject({
			o5PackCount: 4,
			spaOfflineOnlyCount: 10,
			subsetTotal: 14,
		});
		expect(breakdown.o5PackLabelsRu).toEqual([
			'Буфер обмена',
			'Музыка',
			'Уведомления',
			'О приложении',
		]);
		expect(breakdown.spaOfflineOnlyLabelsRu).toContain('Хроника');
		expect(breakdown.spaOfflineOnlyLabelsRu).toContain('Poemma');
		expect(breakdown.spaOfflineOnlyLabelsRu).toContain('Настройки стола');
		expect(breakdown.spaOfflineOnlyLabelsRu).toContain('Обслуживание');
		expect(kernelOfflineLabelRu('EmperyNexusChronicleApp')).toBe('Хроника');
		expect(kernelOfflineLabelRu('PoemmaApp')).toBe('Poemma');
		expect(kernelOfflineLabelRu('DesktopAppMaintenance')).toBe('Обслуживание');
		const notice = formatKernelOfflineSubsetNoticeRu();
		expect(notice).toContain('на устройстве —');
		expect(notice).toContain('в рабочем столе —');
		expect(notice).toContain('Poemma');
		expect(notice).toContain('Обслуживание');
		expect(notice).not.toMatch(/Kernel subset|SPA-only|spa_offline/);
	});
});
