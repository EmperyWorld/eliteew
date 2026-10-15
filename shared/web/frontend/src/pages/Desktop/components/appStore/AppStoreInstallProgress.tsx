/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing install/remove progress UI for App Store (catalog bar + sidebar hint).
 *
 * Invariants:
 * - All copy comes from appStore i18n namespace.
 *
 * Related:
 * - useAppStoreInstallFlow.ts, AppStoreInstallStatusBar.tsx
 */

import type { ReactElement } from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { StoreAppResponse } from '../../services/desktopApi';
import { AppStoreInstallStatusBar } from './AppStoreInstallStatusBar';
import type { AppStoreInstallStatus } from './appStoreInstallTypes';

/** Catalog column: sticky install status bar. */
export function AppStoreCatalogInstallStatus({
	t,
	apps,
	installStatus,
	isLoading = false,
}: {
	t: TFunction<'appStore'>;
	apps: StoreAppResponse[];
	installStatus: AppStoreInstallStatus;
	isLoading?: boolean;
}): ReactElement | null {
	if (!installStatus || isLoading) {
		return null;
	}
	return (
		<AppStoreInstallStatusBar
			t={t}
			appName={
				apps.find((a) => a.app_id === installStatus.appId)?.name ??
				installStatus.appId
			}
			action={installStatus.action}
		/>
	);
}

/** Sidebar search block: wait hint while another card is busy. */
export function AppStoreInstallSidebarBusyHint({
	t,
	installingId,
}: {
	t: TFunction<'appStore'>;
	installingId: string | null;
}): ReactElement | null {
	if (installingId === null) {
		return null;
	}
	return (
		<p
			className={cn('mt-2.5 leading-snug', DESKTOP_TYPOGRAPHY.caption)}
			role="status"
			aria-live="polite"
		>
			{t('busyHint')}
		</p>
	);
}
