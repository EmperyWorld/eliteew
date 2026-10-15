/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Open account system folder «Загрузки» via Content Manager deep link.
 *
 * Related:
 * - pages/Desktop/utils/desktopDeepLink.ts
 * - documentation/reference/solution-readiness/2026-09-10-ebrowser-ux-wave-u.md
 */

import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';
import { SYSTEM_FOLDER_ITEM } from '@/pages/ContentManager/sortToSystemFolders';

export function requestOpenEBrowserDownloadsLibrary(): void {
	requestOpenDesktopApp({
		appComponent: 'ContentManagerPro',
		contentManagerFolderItemId: SYSTEM_FOLDER_ITEM.downloads,
	});
}
