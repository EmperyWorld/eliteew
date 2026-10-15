/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: EBrowser downloads CTA opens Content Manager «Загрузки», not OS folder.
 *
 * Related:
 * - features/ebrowser/ebrowserOpenDownloads.ts
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 */

import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_FOLDER_ITEM } from '@/pages/ContentManager/sortToSystemFolders';

const requestOpenDesktopApp = vi.fn();

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	requestOpenDesktopApp: (...args: unknown[]) => requestOpenDesktopApp(...args),
}));

describe('requestOpenEBrowserDownloadsLibrary', () => {
	it('opens ContentManagerPro at account downloads folder', async () => {
		const { requestOpenEBrowserDownloadsLibrary } = await import(
			'./ebrowserOpenDownloads'
		);
		requestOpenEBrowserDownloadsLibrary();
		expect(requestOpenDesktopApp).toHaveBeenCalledWith({
			appComponent: 'ContentManagerPro',
			contentManagerFolderItemId: SYSTEM_FOLDER_ITEM.downloads,
		});
	});
});
