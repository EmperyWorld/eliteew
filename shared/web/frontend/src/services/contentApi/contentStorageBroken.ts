/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect unified_content storage-missing 404s and route users to File Manager «Broken files» tab.
 *
 * Invariants:
 * - Matches stable API 404 detail for missing/corrupted Seaweed objects (post-quarantine or first probe).
 *
 * Related:
 * - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
 * - BrokenFilesPanel.tsx, content_storage_error_detail.py
 */

import { APIError } from '@/services/api/client';
import {
	requestOpenDesktopApp,
	type DesktopOpenAppDetail,
} from '@/pages/Desktop/utils/desktopDeepLink';
import {
	CONTENT_MANAGER_URL_TABS,
	type ContentManagerTab,
} from '@/pages/ContentManager/contentManagerTypes';

export function isContentStorageObjectUnavailable(error: unknown): boolean {
	return error instanceof APIError && error.statusCode === 404;
}

export function openContentManagerBrokenFilesTab(): void {
	const detail: DesktopOpenAppDetail = {
		appComponent: 'ContentManagerPro',
		contentManagerInitialTab: 'brokenFiles',
	};
	requestOpenDesktopApp(detail);
}

export function resolveContentManagerInitialTab(
	value: unknown
): ContentManagerTab | undefined {
	if (typeof value !== 'string') return undefined;
	const tab = value.trim();
	return CONTENT_MANAGER_URL_TABS.has(tab as ContentManagerTab)
		? (tab as ContentManagerTab)
		: undefined;
}
