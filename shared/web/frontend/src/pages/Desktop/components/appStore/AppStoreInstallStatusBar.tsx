/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky progress banner for install/remove in the App Store catalog.
 *
 * Invariants:
 * - Display only; operation is driven by useAppStoreInstallFlow.
 *
 * Related:
 * - AppStoreInstallProgress.tsx, useAppStoreInstallFlow.ts
 */

import type { ReactElement } from 'react';
import type { TFunction } from 'i18next';
import { Spinner } from '@/components/ui/primitives/Spinner';
import {
	appStoreInstallStatusBarClass,
	appStoreInstallStatusBarLabelClass,
} from '../../utils/appStoreCompactCardUi';
import type { AppStoreInstallAction } from './appStoreInstallTypes';

export type AppStoreInstallStatusBarProps = {
	t: TFunction<'appStore'>;
	appName: string;
	action: AppStoreInstallAction;
};

export function AppStoreInstallStatusBar({
	t,
	appName,
	action,
}: AppStoreInstallStatusBarProps): ReactElement {
	const label =
		action === 'uninstall'
			? t('installStatus.uninstalling', { name: appName })
			: t('installStatus.installing', { name: appName });

	return (
		<div
			className={appStoreInstallStatusBarClass}
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<Spinner size="sm" color="blue" type="spin" />
			<span className={appStoreInstallStatusBarLabelClass}>{label}</span>
		</div>
	);
}
