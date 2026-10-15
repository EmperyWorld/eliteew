/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store main-column hero and mobile catalog/search bar — premium metrics
 * and sticky mobile context.
 *
 * Invariants:
 * - Search focus delegates to focusAppStoreCatalogSearch (sidebar input attr).
 * - Hero hidden when filters active or category !== all (parent gates render).
 * - Metric labels use sentence-case `appStorePremiumMetricLabelClass` — not
 *   `labelOverline` uppercase shout.
 *
 * Related:
 * - AppStore.tsx, appStoreFocus.ts, appStoreCompactCardUi.ts
 * - documentation/product/desktop/DESKTOP-APP-STORE.md
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { focusAppStoreCatalogSearch } from '../../utils/appStoreFocus';
import {
	appStoreMobileCatalogTitleClass,
	appStorePremiumHeroLeadClass,
	appStorePremiumMetricLabelClass,
	appStorePremiumMetricValueClass,
	appStorePremiumMetricValueInstalledClass,
} from '../../utils/appStoreCompactCardUi';
import { categoryLabel } from './appStoreCategories';
import type { StoreCategoryDef } from './appStoreCatalogTypes';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export type AppStoreMobileCatalogBarProps = {
	t: TFunction<'appStore'>;
	embeddedMobileLayout: boolean;
	activeCategory: string | 'all';
	filteredAppsCount: number;
	appsCount: number;
	filtersActive: boolean;
	categoryHintText: (categoryId: string) => string;
	onClearFilters: () => void;
};

export function AppStoreMobileCatalogBar({
	t,
	embeddedMobileLayout,
	activeCategory,
	filteredAppsCount,
	appsCount,
	filtersActive,
	categoryHintText,
	onClearFilters,
}: AppStoreMobileCatalogBarProps): ReactElement {
	return (
		<section
			className={cn(
				'sticky top-0 z-10 -mx-4 mb-5 border-b border-(--desktop-border-subtle)/60 bg-[color-mix(in_srgb,var(--desktop-surface-app)_92%,transparent)] px-4 py-3 backdrop-blur-md',
				!embeddedMobileLayout && 'lg:hidden'
			)}
			aria-label={t('mobile.catalogBarAria')}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<p className={appStoreMobileCatalogTitleClass}>
						{activeCategory === 'all'
							? t('nav.all')
							: categoryLabel(activeCategory, t)}
					</p>
					<p
						className={cn(
							'tabular-nums text-(--desktop-text-dim)',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
					>
						{t('search.showingCount', {
							shown: filteredAppsCount,
							total: appsCount,
						})}
					</p>
				</div>
				{filtersActive ? (
					<DesktopChromeTooltip
						content={t('mobile.resetFilters')}
						placement="bottom"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="shrink-0"
							onClick={onClearFilters}
						>
							{t('mobile.resetFilters')}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				) : embeddedMobileLayout ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className="shrink-0"
						aria-label={t('mobile.focusSearch')}
						onClick={focusAppStoreCatalogSearch}
					>
						<MagnifyingGlassIcon className="h-5 w-5 text-(--desktop-text-muted)" />
					</DesktopAppButton>
				) : (
					<DesktopChromeTooltip
						content={t('search.shortcutHint')}
						placement="bottom"
						offsetExtra={6}
					>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="shrink-0 lg:hidden"
							aria-label={t('mobile.focusSearch')}
							onClick={focusAppStoreCatalogSearch}
						>
							<MagnifyingGlassIcon className="h-5 w-5 text-(--desktop-text-muted)" />
						</DesktopAppButton>
					</DesktopChromeTooltip>
				)}
			</div>
			{activeCategory !== 'all' ? (
				<p
					className={cn(
						'mt-2 line-clamp-2 leading-snug text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.caption
					)}
				>
					{categoryHintText(activeCategory)}
				</p>
			) : null}
		</section>
	);
}

type PremiumMetricTone = 'default' | 'installed';

function AppStorePremiumMetricCard({
	label,
	value,
	cardClassName,
	valueSizeClass,
	tone = 'default',
}: {
	label: string;
	value: number;
	cardClassName: string;
	valueSizeClass: string;
	tone?: PremiumMetricTone;
}): ReactElement {
	return (
		<div className={cardClassName}>
			<p className={appStorePremiumMetricLabelClass}>{label}</p>
			<p
				className={cn(
					tone === 'installed'
						? appStorePremiumMetricValueInstalledClass
						: appStorePremiumMetricValueClass,
					valueSizeClass
				)}
			>
				{value}
			</p>
		</div>
	);
}

export type AppStorePremiumStorefrontHeroProps = {
	t: TFunction<'appStore'>;
	embeddedMobileLayout: boolean;
	premiumHeroClass: string;
	premiumMetricCard: string;
	installedCount: number;
	availableCount: number;
	visibleStoreCategories: StoreCategoryDef[];
};

export function AppStorePremiumStorefrontHero({
	t,
	embeddedMobileLayout,
	premiumHeroClass,
	premiumMetricCard,
	installedCount,
	availableCount,
	visibleStoreCategories,
}: AppStorePremiumStorefrontHeroProps): ReactElement {
	const metrics = (
		<>
			<AppStorePremiumMetricCard
				label={t('premium.metricInstalled')}
				value={installedCount}
				cardClassName={premiumMetricCard}
				valueSizeClass={embeddedMobileLayout ? 'text-base' : 'text-lg'}
				tone="installed"
			/>
			<AppStorePremiumMetricCard
				label={t('premium.metricAvailable')}
				value={availableCount}
				cardClassName={premiumMetricCard}
				valueSizeClass={embeddedMobileLayout ? 'text-base' : 'text-lg'}
			/>
			<AppStorePremiumMetricCard
				label={t('premium.metricCategories')}
				value={visibleStoreCategories.length}
				cardClassName={premiumMetricCard}
				valueSizeClass={embeddedMobileLayout ? 'text-base' : 'text-lg'}
			/>
		</>
	);

	if (embeddedMobileLayout) {
		return (
			<section
				className={cn(premiumHeroClass, 'mb-4 px-3 py-3')}
				aria-label={t('nav.summary')}
			>
				<div className="grid grid-cols-3 gap-2">{metrics}</div>
			</section>
		);
	}

	return (
		<section
			className={cn(
				premiumHeroClass,
				'relative mb-6 overflow-hidden px-4 py-4 md:px-5 md:py-5'
			)}
			aria-labelledby="app-store-premium-title"
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-full bg-white/18"
			/>
			<div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.14)] blur-3xl" />
			<div className="pointer-events-none absolute bottom-0 left-8 h-px w-2/3 bg-linear-to-r from-transparent via-(--mc-accent-40) to-transparent" />
			<div
				className={cn(
					'relative flex flex-col gap-5',
					'lg:flex-row lg:items-end lg:justify-between'
				)}
			>
				<div className="min-w-0 max-w-2xl">
					<h2
						id="app-store-premium-title"
						className={cn(
							DESKTOP_TYPOGRAPHY.title,
							'text-2xl font-semibold tracking-[-0.03em] text-(--desktop-text-primary) md:text-[1.75rem]'
						)}
					>
						{t('premium.title')}
					</h2>
					<p className={appStorePremiumHeroLeadClass}>
						{t('premium.subtitle')}
					</p>
				</div>
				<div className="grid min-w-0 grid-cols-3 gap-2 sm:min-w-88 sm:gap-2.5">
					{metrics}
				</div>
			</div>
		</section>
	);
}
