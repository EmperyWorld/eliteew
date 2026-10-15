/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Happy-path App Store detail body — hero, quick facts, tags, expansion notes,
 * disclosures, related apps; action bar via AppStoreDetailActionBar.
 *
 * Invariants:
 * - Requires a resolved `detail` from useAppStoreDetailController (no loading/error branch).
 * - Install/uninstall UI respects cannotUninstall / allowInstall derived flags.
 *
 * Related:
 * - AppStoreCard.tsx, AppStoreDetailActionBar.tsx, AppStoreDetailDisclosures.tsx
 */

import { cn } from '@/utils/cn';
import type { DesktopIconStyle } from '@/types/profile';
import {
	ArrowLeftIcon,
	CheckCircleIcon,
	ChevronRightIcon,
	LinkIcon,
} from '@heroicons/react/24/outline';
import type { ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type {
	StoreAppDetailResponse,
	StoreAppResponse,
} from '../../services/desktopApi';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { AppStoreDetailHeroBackdrop } from '../../utils/storeAppMedia';
import { getDesktopShellToolbarClusterInsetControlClassName } from '../../utils/desktopVisualSystem';
import {
	appStoreAccentSoftBadgeClass,
	appStoreDescriptionToggleClass,
	appStoreDetailExpansionPanelClass,
	appStoreDetailInlineHeadingClass,
	appStoreDetailInsetPanelClass,
	appStoreDetailNoteTextClass,
	appStoreDetailQuickFactLabelClass,
	appStoreDetailQuickFactValueClass,
	appStoreDetailQuickFactValueMutedClass,
	appStoreDetailSectionTitleClass,
	appStoreDetailTagsPanelClass,
	appStoreFactoryBadgeClass,
	appStoreFactoryNotePanelClass,
	appStoreInstalledBadgeClass,
	appStoreMaintenanceBadgeClass,
	appStoreMaintenanceNotePanelClass,
	appStoreNeutralBadgeClass,
	appStoreShortcutBadgeClass,
	appStoreSystemBadgeClass,
} from '../../utils/appStoreCompactCardUi';
import { DesktopAppButton, DesktopAppStatusBadge } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { DescriptionClampOverflow } from '../DescriptionClampOverflow';
import { AppStoreCatalogBadge } from '../AppStoreCatalogBadge';
import { AppStoreRelatedAppsRow } from '../AppStoreRelatedAppsRow';
import { AppStoreDetailActionBar } from './AppStoreDetailActionBar';
import { AppStoreDetailDisclosures } from './AppStoreDetailDisclosures';
import type { AppStoreDetailBusyAction } from './useAppStoreDetailController';
import type { DesktopWindowMinSize } from '../../utils/desktopWindowMinSizeRegistry';

export type AppStoreDetailBodyProps = {
	detailShellClass: string;
	detail: StoreAppDetailResponse | StoreAppResponse;
	t: TFunction<'appStore'>;
	onBack: () => void;
	iconStyle: DesktopIconStyle;
	relatedApps: StoreAppResponse[];
	onRelatedAppClick?: (appId: string) => void;
	defaultIcon?: ReactNode;
	defaultAppsMap: ReadonlyMap<string, ReactNode>;
	categoryLabel: string;
	billingCaption: string;
	heroGradient: string;
	windowsPolicyLabel: string;
	minWindowSize: DesktopWindowMinSize | null;
	inMaintenance: boolean;
	maintenanceHint: string;
	workspaceNames: string[];
	collectionNames: string[];
	isShortcutOnDesktop: boolean;
	winMax: number;
	allowsMultipleInstances: boolean;
	showTechnicalDetails: boolean;
	billingExempt: boolean;
	ewPrice: number;
	trialDays: number;
	cannotUninstall: boolean;
	uninstallBlockedTitle: string;
	allowInstall: boolean;
	installPrimaryLabel: string;
	busy: boolean;
	busyAction: AppStoreDetailBusyAction;
	busyLabel: string;
	onOpenInstalledApp?: (appComponent: string) => void;
	handleInstall: () => void;
	handleOpenInstalled: () => void;
	handleCopyDeepLink: () => void;
};

export function AppStoreDetailBody({
	detailShellClass,
	detail,
	t,
	onBack,
	iconStyle,
	relatedApps,
	onRelatedAppClick,
	defaultIcon,
	defaultAppsMap,
	categoryLabel,
	billingCaption,
	heroGradient,
	windowsPolicyLabel,
	minWindowSize,
	inMaintenance,
	maintenanceHint,
	workspaceNames,
	collectionNames,
	isShortcutOnDesktop,
	winMax,
	allowsMultipleInstances,
	showTechnicalDetails,
	billingExempt,
	ewPrice,
	trialDays,
	cannotUninstall,
	uninstallBlockedTitle,
	allowInstall,
	installPrimaryLabel,
	busy,
	busyAction,
	busyLabel,
	onOpenInstalledApp,
	handleInstall,
	handleOpenInstalled,
	handleCopyDeepLink,
}: AppStoreDetailBodyProps): ReactElement {
	const shellFrame = useDesktopShellFrame();
	const sectionTitleClass = appStoreDetailSectionTitleClass;
	const detailNoteClass = appStoreDetailNoteTextClass;

	return (
		<div className="mx-auto w-full max-w-3xl">
			<div className={detailShellClass}>
				<div
					className="pointer-events-none h-1 shrink-0 bg-linear-to-r from-[rgb(var(--desktop-accent-rgb)/0.55)] via-[rgb(var(--desktop-accent-rgb)/0.24)] to-transparent"
					aria-hidden
				/>
				<div className="relative">
					<div
						className="pointer-events-none absolute inset-0 z-1 bg-linear-to-b from-transparent via-transparent to-[rgb(var(--desktop-bg-primary-rgb)/0.18)]"
						aria-hidden
					/>
					<AppStoreDetailHeroBackdrop
						app={detail}
						heroGradientClassName={heroGradient}
					/>
					<div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 px-5 pb-4 md:px-6">
						<div className="relative -mb-10 shrink-0 md:-mb-12">
							<AppStoreCatalogBadge
								app={detail}
								defaultIcon={defaultIcon}
								iconStyle={iconStyle}
								className="h-19 w-19 shadow-[0_20px_42px_-18px_rgb(0_0_0/0.52)] ring-2 ring-[rgb(var(--desktop-fg-primary-rgb)/0.16)] md:h-24 md:w-24"
							/>
						</div>
						<DesktopChromeTooltip
							content={t('detail.back')}
							placement="bottom"
							offsetExtra={6}
						>
							<DesktopAppButton
								type="button"
								onClick={onBack}
								variant="ghost"
								size="sm"
								className={cn(
									'relative shrink-0 gap-1.5 backdrop-blur-md shadow-[0_4px_16px_-4px_rgb(0_0_0/0.28)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.18)] transition-[box-shadow,transform] hover:shadow-[0_6px_20px_-4px_rgb(0_0_0/0.32)] active:scale-[0.98]',
									getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
								)}
								aria-label={t('detail.backAria')}
							>
								<ArrowLeftIcon
									width={18}
									height={18}
									className="text-(--desktop-text-muted)"
								/>
								<span className="hidden sm:inline">{t('detail.back')}</span>
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</div>
				</div>

				<div className="p-5 pt-16 md:p-6 md:pt-20">
					<nav className="mb-4" aria-label={t('detail.breadcrumbAria')}>
						<ol
							className={cn(
								'flex flex-wrap items-center gap-1 text-(--desktop-text-dim)',
								DESKTOP_TYPOGRAPHY.meta
							)}
						>
							<li>
								<DesktopChromeTooltip
									content={t('detail.breadcrumbStore')}
									placement="top"
									offsetExtra={4}
								>
									<button
										type="button"
										onClick={onBack}
										className="rounded-sm font-medium text-(--desktop-text-muted) transition-colors hover:text-(--desktop-text-primary) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)]"
									>
										{t('detail.breadcrumbStore')}
									</button>
								</DesktopChromeTooltip>
							</li>
							<li aria-hidden className="opacity-60">
								<ChevronRightIcon className="h-3 w-3" />
							</li>
							<li className="text-(--desktop-text-muted)">{categoryLabel}</li>
							<li aria-hidden className="opacity-60">
								<ChevronRightIcon className="h-3 w-3" />
							</li>
							<li aria-current="page">
								<DesktopChromeTooltip
									content={detail.name}
									placement="top"
									offsetExtra={4}
								>
									<span className="block max-w-[min(100%,14rem)] truncate font-medium text-(--desktop-text-secondary)">
										{detail.name}
									</span>
								</DesktopChromeTooltip>
							</li>
						</ol>
					</nav>
					<div className="mb-5 min-w-0 rounded-2xl border border-(--desktop-border-subtle)/65 bg-(--as-premium-panel-bg) px-4 py-4 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)] ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)]">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h2
									className={cn(
										DESKTOP_TYPOGRAPHY.title,
										'text-xl font-bold tracking-tight md:text-2xl'
									)}
								>
									{detail.name}
								</h2>
								<p className={cn('mt-1.5', DESKTOP_TYPOGRAPHY.meta)}>
									{categoryLabel}
								</p>
							</div>
							<span
								className={cn(
									'inline-flex shrink-0 items-center rounded-full border border-(--desktop-border-subtle)/90 bg-(--as-premium-action-bg) px-3 py-1.5 font-semibold tracking-wide text-(--desktop-text-secondary) tabular-nums shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
							>
								{billingCaption}
							</span>
							<DesktopChromeTooltip
								content={t('detail.copyLink')}
								placement="bottom"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className="shrink-0 gap-1.5 rounded-lg"
									onClick={() => void handleCopyDeepLink()}
									aria-label={t('detail.copyLinkAria')}
								>
									<LinkIcon
										className={DESKTOP_LUCIDE.sm}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									<span className="hidden sm:inline">
										{t('detail.copyLink')}
									</span>
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</div>
					</div>

					<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div className={appStoreDetailInsetPanelClass}>
							<p className={appStoreDetailQuickFactLabelClass}>
								{t('detail.quickFacts.tariff')}
							</p>
							<p className={appStoreDetailQuickFactValueClass}>
								{billingCaption}
							</p>
						</div>
						<div className={appStoreDetailInsetPanelClass}>
							<p className={appStoreDetailQuickFactLabelClass}>
								{t('detail.quickFacts.windows')}
							</p>
							<p className={appStoreDetailQuickFactValueMutedClass}>
								{windowsPolicyLabel}
							</p>
						</div>
						<div className={appStoreDetailInsetPanelClass}>
							<p className={appStoreDetailQuickFactLabelClass}>
								{t('detail.quickFacts.status')}
							</p>
							<p
								className={cn(
									appStoreDetailQuickFactValueClass,
									'flex items-center gap-1.5'
								)}
							>
								{detail.installed ? (
									<>
										<CheckCircleIcon
											width={16}
											height={16}
											className="shrink-0 text-[color-mix(in_srgb,rgb(16_185_129)_62%,var(--desktop-text-secondary))]"
											aria-hidden
										/>
										{t('installed')}
									</>
								) : (
									t('notInstalled')
								)}
							</p>
						</div>
					</div>
					{minWindowSize ? (
						<p className={cn(DESKTOP_TYPOGRAPHY.body, 'mb-6 leading-relaxed')}>
							{t('detail.minWindowSize', {
								w: minWindowSize.minWidth,
								h: minWindowSize.minHeight,
							})}
						</p>
					) : null}

					<div className="mb-6">
						<h3 className={sectionTitleClass}>{t('description.section')}</h3>
						{detail.description ? (
							<DescriptionClampOverflow
								text={detail.description}
								lineClamp={5}
								paragraphClassName={cn(
									'leading-[1.6] text-(--desktop-text-secondary)',
									DESKTOP_TYPOGRAPHY.shellCopy15
								)}
								toggleClassName={appStoreDescriptionToggleClass}
								moreLabel={t('description.more')}
								lessLabel={t('description.less')}
							/>
						) : (
							<p className={DESKTOP_TYPOGRAPHY.bodyMuted}>
								{t('description.none')}
							</p>
						)}
					</div>

					<div className="mb-6">
						<h3 className={sectionTitleClass}>{t('detail.tags')}</h3>
						<div className={appStoreDetailTagsPanelClass}>
							<DesktopAppStatusBadge className={appStoreNeutralBadgeClass}>
								{categoryLabel}
							</DesktopAppStatusBadge>
							{detail.installed ? (
								<DesktopAppStatusBadge className={appStoreInstalledBadgeClass}>
									{t('installed')}
								</DesktopAppStatusBadge>
							) : null}
							{detail.is_system ? (
								<DesktopAppStatusBadge className={appStoreSystemBadgeClass}>
									{t('system')}
								</DesktopAppStatusBadge>
							) : null}
							{detail.is_factory ? (
								<DesktopAppStatusBadge className={appStoreFactoryBadgeClass}>
									{t('factory')}
								</DesktopAppStatusBadge>
							) : null}
							{inMaintenance ? (
								<DesktopAppStatusBadge
									className={appStoreMaintenanceBadgeClass}
								>
									{t('maintenance.badge')}
								</DesktopAppStatusBadge>
							) : null}
							{workspaceNames.length > 0 ? (
								<DesktopAppStatusBadge className={appStoreAccentSoftBadgeClass}>
									{t('desktopExpansion.workspaceBadge', {
										count: workspaceNames.length,
									})}
								</DesktopAppStatusBadge>
							) : null}
							{collectionNames.length > 0 ? (
								<DesktopAppStatusBadge className={appStoreNeutralBadgeClass}>
									{t('desktopExpansion.collectionBadge', {
										count: collectionNames.length,
									})}
								</DesktopAppStatusBadge>
							) : null}
							{isShortcutOnDesktop ? (
								<DesktopAppStatusBadge className={appStoreShortcutBadgeClass}>
									{t('desktopExpansion.shortcutOnDesktopBadge')}
								</DesktopAppStatusBadge>
							) : null}
							<DesktopAppStatusBadge
								className={
									allowsMultipleInstances
										? appStoreAccentSoftBadgeClass
										: appStoreNeutralBadgeClass
								}
							>
								{allowsMultipleInstances
									? t('card.windowsBadgeMultiple', { count: winMax })
									: t('card.windowsBadgeSingle')}
							</DesktopAppStatusBadge>
						</div>
					</div>

					{workspaceNames.length > 0 || collectionNames.length > 0 ? (
						<div className={appStoreDetailExpansionPanelClass}>
							<h3 className={appStoreDetailInlineHeadingClass}>
								{t('desktopExpansion.detailTitle')}
							</h3>
							{workspaceNames.length > 0 ? (
								<p className="text-(--desktop-text-secondary)">
									{t('desktopExpansion.detailWorkspaces', {
										names: workspaceNames.join(', '),
									})}
								</p>
							) : null}
							{collectionNames.length > 0 ? (
								<p className="mt-1 text-(--desktop-text-secondary)">
									{t('desktopExpansion.detailCollections', {
										names: collectionNames.join(', '),
									})}
								</p>
							) : null}
						</div>
					) : null}

					{inMaintenance ? (
						<p
							className={cn(
								appStoreMaintenanceNotePanelClass,
								'mb-6',
								detailNoteClass
							)}
							role="note"
						>
							{detail.maintenance_reason?.trim()
								? detail.maintenance_reason.trim()
								: detail.maintenance_title?.trim()
									? detail.maintenance_title.trim()
									: maintenanceHint}
						</p>
					) : null}

					<AppStoreDetailDisclosures
						detail={detail}
						t={t}
						showTechnicalDetails={showTechnicalDetails}
						billingExempt={billingExempt}
						ewPrice={ewPrice}
						trialDays={trialDays}
					/>

					{cannotUninstall && detail.is_factory ? (
						<p
							className={cn(
								appStoreFactoryNotePanelClass,
								'mb-4',
								detailNoteClass
							)}
							role="note"
						>
							{t('uninstallBlocked.factoryExplain')}
						</p>
					) : null}

					{relatedApps.length > 0 && onRelatedAppClick ? (
						<AppStoreRelatedAppsRow
							apps={relatedApps}
							defaultIcons={defaultAppsMap}
							iconStyle={iconStyle}
							onAppClick={onRelatedAppClick}
						/>
					) : null}

					<AppStoreDetailActionBar
						detail={detail}
						t={t}
						cannotUninstall={cannotUninstall}
						uninstallBlockedTitle={uninstallBlockedTitle}
						allowInstall={allowInstall}
						installPrimaryLabel={installPrimaryLabel}
						inMaintenance={inMaintenance}
						maintenanceHint={maintenanceHint}
						busy={busy}
						busyAction={busyAction}
						busyLabel={busyLabel}
						onOpenInstalledApp={onOpenInstalledApp}
						handleInstall={handleInstall}
						handleOpenInstalled={handleOpenInstalled}
					/>
				</div>
			</div>
		</div>
	);
}
