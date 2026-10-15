/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store detail action bar — installed/system/factory status chips plus
 * open / install / uninstall CTAs with busy and permission gates.
 *
 * Invariants:
 * - Install CTA disabled when busy or !allowInstall.
 * - Uninstall CTA disabled when busy or cannotUninstall; blocked title via tooltip.
 *
 * Related:
 * - AppStoreDetailBody.tsx, useAppStoreDetailController.ts
 */

import { Spinner } from '@/components/ui/primitives/Spinner';
import {
	ArrowDownTrayIcon,
	CheckCircleIcon,
	ComputerDesktopIcon,
	ShieldCheckIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { DESKTOP_LUCIDE } from '../../constants';
import type {
	StoreAppDetailResponse,
	StoreAppResponse,
} from '../../services/desktopApi';
import {
	appStoreDetailActionBarClass,
	appStoreDetailFactoryStatusClass,
	appStoreDetailInstalledStatusClass,
	appStoreDetailSystemStatusClass,
} from '../../utils/appStoreCompactCardUi';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { AppStoreDetailBusyAction } from './useAppStoreDetailController';

export type AppStoreDetailActionBarProps = {
	detail: StoreAppDetailResponse | StoreAppResponse;
	t: TFunction<'appStore'>;
	cannotUninstall: boolean;
	uninstallBlockedTitle: string;
	allowInstall: boolean;
	installPrimaryLabel: string;
	inMaintenance: boolean;
	maintenanceHint: string;
	busy: boolean;
	busyAction: AppStoreDetailBusyAction;
	busyLabel: string;
	onOpenInstalledApp?: (appComponent: string) => void;
	handleInstall: () => void;
	handleOpenInstalled: () => void;
};

export function AppStoreDetailActionBar({
	detail,
	t,
	cannotUninstall,
	uninstallBlockedTitle,
	allowInstall,
	installPrimaryLabel,
	inMaintenance,
	maintenanceHint,
	busy,
	busyAction,
	busyLabel,
	onOpenInstalledApp,
	handleInstall,
	handleOpenInstalled,
}: AppStoreDetailActionBarProps): ReactElement {
	return (
		<div className={appStoreDetailActionBarClass}>
			<div className="flex flex-wrap items-center gap-4">
				{detail.installed ? (
					<div className={appStoreDetailInstalledStatusClass}>
						<CheckCircleIcon width={16} height={16} aria-hidden />
						{t('detail.onDesktop')}
					</div>
				) : null}
				{detail.is_system ? (
					<div className={appStoreDetailSystemStatusClass}>
						<ShieldCheckIcon width={16} height={16} aria-hidden />
						{t('detail.systemApp')}
					</div>
				) : null}
				{detail.is_factory ? (
					<div className={appStoreDetailFactoryStatusClass}>
						<ShieldCheckIcon width={16} height={16} aria-hidden />
						{t('detail.factoryApp')}
					</div>
				) : null}
			</div>

			<div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
				{detail.installed && onOpenInstalledApp && detail.app_component ? (
					<DesktopChromeTooltip
						content={busy ? t('waitOtherOp') : undefined}
						placement="top"
						offsetExtra={6}
					>
						<span className="inline-flex">
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={busy}
								aria-label={`${t('openApp')}: ${detail.name}`}
								onClick={handleOpenInstalled}
							>
								<ComputerDesktopIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('openApp')}
							</DesktopAppButton>
						</span>
					</DesktopChromeTooltip>
				) : null}
				{detail.installed ? (
					<DesktopChromeTooltip
						content={
							cannotUninstall
								? uninstallBlockedTitle
								: busy && busyAction !== 'uninstall'
									? t('waitOtherOp')
									: undefined
						}
						placement="top"
						offsetExtra={6}
					>
						<span className="inline-flex">
							<DesktopAppButton
								type="button"
								disabled={busy || cannotUninstall}
								aria-label={
									busy
										? t('inProgress')
										: cannotUninstall
											? uninstallBlockedTitle
											: `${t('uninstall')} ${detail.name}`
								}
								onClick={() => void handleInstall()}
								variant={cannotUninstall ? 'neutral' : 'danger'}
							>
								{busy && busyAction === 'uninstall' ? (
									<span className="inline-flex items-center gap-2">
										<Spinner size="sm" color="white" type="spin" />
										{busyLabel}
									</span>
								) : cannotUninstall ? (
									t('installed')
								) : (
									<>
										<TrashIcon
											className={DESKTOP_LUCIDE.md}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('uninstall')}
									</>
								)}
							</DesktopAppButton>
						</span>
					</DesktopChromeTooltip>
				) : (
					<DesktopChromeTooltip
						content={
							!allowInstall
								? inMaintenance
									? maintenanceHint
									: t('detail.cannotInstallHint')
								: busy && busyAction !== 'install'
									? t('waitOtherOp')
									: undefined
						}
						placement="top"
						offsetExtra={6}
					>
						<span className="inline-flex">
							<DesktopAppButton
								type="button"
								disabled={busy || !allowInstall}
								aria-label={
									busy
										? t('inProgress')
										: !allowInstall && inMaintenance
											? `${detail.name}. ${maintenanceHint}`
											: `${t('installVerb')} ${detail.name}`
								}
								onClick={() => void handleInstall()}
								variant="accent"
							>
								{busy && busyAction === 'install' ? (
									<span className="inline-flex items-center gap-2">
										<Spinner size="sm" color="white" type="spin" />
										{busyLabel}
									</span>
								) : (
									<>
										<ArrowDownTrayIcon
											className={DESKTOP_LUCIDE.md}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{installPrimaryLabel}
									</>
								)}
							</DesktopAppButton>
						</span>
					</DesktopChromeTooltip>
				)}
			</div>
		</div>
	);
}
