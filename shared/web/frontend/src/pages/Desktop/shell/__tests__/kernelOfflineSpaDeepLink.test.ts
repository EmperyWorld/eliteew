/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lock K5–K6 shared Kernel-offline spa_deep_link + offline_spa_subset helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	isKernelOfflineSpaDeepLinkAppId,
	isKernelOfflineSpaSubsetAppId,
	KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS,
	KERNEL_OFFLINE_SPA_SUBSET_APP_IDS,
	formatKernelOfflineSubsetNoticeRu,
	kernelOfflineSubsetBreakdown,
} from '../kernelOfflineSpaDeepLink';
import { shouldDenyOpenOutsideKernelOfflineSubset } from '../kernelOfflineOpenGate';
import { filterDesktopItemsByKernelOfflineSubset } from '../kernelOfflineOpenGate';
import type { DesktopItem } from '../../types/desktop.types';

describe('kernelOfflineSpaDeepLink (K5–K6 shared SoT)', () => {
	it('lists spa_deep_link pack apps from shared policy', () => {
		expect(KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS).toEqual([
			'ClipboardManager',
			'MusicPlayer',
			'NotificationsApp',
		]);
	});

	it('lists offline_spa_subset as O5 pack + K10–K17 spa_offline_only', () => {
		expect(KERNEL_OFFLINE_SPA_SUBSET_APP_IDS).toEqual([
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
	});

	it('accepts spa_deep_link ids and rejects presentation-only', () => {
		expect(isKernelOfflineSpaDeepLinkAppId('ClipboardManager')).toBe(true);
		expect(isKernelOfflineSpaDeepLinkAppId('ProjectAboutApp')).toBe(false);
		expect(isKernelOfflineSpaDeepLinkAppId('NotAMount')).toBe(false);
	});

	it('marks pack apps and spa_offline_only family as offline subset', () => {
		expect(isKernelOfflineSpaSubsetAppId('ProjectAboutApp')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('DocEditor')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('DocEditorV2')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('Presentations')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('PresentationsArchive')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('EmperyNexusChronicleApp')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('PoemmaApp')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('AssistantApp')).toBe(true);
		expect(isKernelOfflineSpaSubsetAppId('GAFChatApp')).toBe(false);
	});

	it('exposes K17 pack vs SPA-only breakdown for Start Menu notice', () => {
		expect(kernelOfflineSubsetBreakdown()).toMatchObject({
			o5PackCount: 4,
			spaOfflineOnlyCount: 11,
			subsetTotal: 15,
		});
		expect(formatKernelOfflineSubsetNoticeRu()).toContain('на устройстве');
		expect(formatKernelOfflineSubsetNoticeRu()).toContain('в рабочем столе');
		expect(formatKernelOfflineSubsetNoticeRu()).toContain('Poemma');
		expect(formatKernelOfflineSubsetNoticeRu()).toContain('Ассистент');
		expect(formatKernelOfflineSubsetNoticeRu()).toContain('Обслуживание');
		expect(formatKernelOfflineSubsetNoticeRu()).not.toMatch(
			/Kernel subset|SPA-only|spa_offline/
		);
	});
});

describe('kernelOfflineOpenGate (K6/K10–K12)', () => {
	it('denies non-subset when desktopNative and offline', () => {
		expect(
			shouldDenyOpenOutsideKernelOfflineSubset({
				appComponent: 'GAFChatApp',
				desktopNative: true,
				online: false,
			})
		).toBe(true);
	});

	it('allows subset when desktopNative and offline', () => {
		expect(
			shouldDenyOpenOutsideKernelOfflineSubset({
				appComponent: 'ClipboardManager',
				desktopNative: true,
				online: false,
			})
		).toBe(false);
	});

	it('allows spa_offline_only DocEditors, Presentations, Chronicle, Poemma, maintenance when offline', () => {
		for (const id of [
			'DocEditor',
			'DocEditorV2',
			'Presentations',
			'PresentationsArchive',
			'EmperyNexusChronicleApp',
			'PoemmaApp',
			'DesktopWidgetShelfApp',
			'DesktopDashboardFavoritesApp',
			'DesktopAppMaintenance',
		] as const) {
			expect(
				shouldDenyOpenOutsideKernelOfflineSubset({
					appComponent: id,
					desktopNative: true,
					online: false,
				})
			).toBe(false);
		}
	});
	it('does not deny when online or non-native', () => {
		expect(
			shouldDenyOpenOutsideKernelOfflineSubset({
				appComponent: 'GAFChatApp',
				desktopNative: true,
				online: true,
			})
		).toBe(false);
		expect(
			shouldDenyOpenOutsideKernelOfflineSubset({
				appComponent: 'GAFChatApp',
				desktopNative: false,
				online: false,
			})
		).toBe(false);
	});

	it('exempts shell-only install-profile components', () => {
		expect(
			shouldDenyOpenOutsideKernelOfflineSubset({
				appComponent: 'DesktopShellSettings',
				desktopNative: true,
				online: false,
			})
		).toBe(false);
	});
});

describe('filterDesktopItemsByKernelOfflineSubset (K7)', () => {
	const items: DesktopItem[] = [
		{
			id: 'a',
			name: 'Clip',
			type: 'app',
			position: { x: 0, y: 0 },
			appComponent: 'ClipboardManager',
		},
		{
			id: 'b',
			name: 'GAF',
			type: 'app',
			position: { x: 0, y: 0 },
			appComponent: 'GAFChatApp',
		},
		{
			id: 'c',
			name: 'Settings',
			type: 'app',
			position: { x: 0, y: 0 },
			appComponent: 'DesktopShellSettings',
		},
	];

	it('passes through when online', () => {
		expect(
			filterDesktopItemsByKernelOfflineSubset(items, {
				desktopNative: true,
				online: true,
			})
		).toHaveLength(3);
	});

	it('keeps subset + shell exempts when offline desktopNative', () => {
		const filtered = filterDesktopItemsByKernelOfflineSubset(items, {
			desktopNative: true,
			online: false,
		});
		expect(filtered.map((i) => i.appComponent)).toEqual([
			'ClipboardManager',
			'DesktopShellSettings',
		]);
	});
});
