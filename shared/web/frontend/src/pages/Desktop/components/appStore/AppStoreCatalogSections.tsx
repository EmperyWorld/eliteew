/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Catalog grid sections for App Store — loading skeleton, empty state, category grids.
 *
 * Invariants:
 * - Card install UX delegated to useAppStoreCatalogCardRenderer + useAppStoreInstallFlow.
 *
 * Related:
 * - AppStore.tsx, AppStoreCatalogCard.tsx, useAppStoreCatalogCardRenderer.tsx
 */

import { cn } from '@/utils/cn';
import { m } from 'framer-motion';
import type { TFunction } from 'i18next';
import type { ReactElement, ReactNode } from 'react';
import type { DesktopIconStyle } from '@/types/profile';
import { Spinner } from '@/components/ui/primitives/Spinner';
import type { StoreAppResponse } from '../../services/desktopApi';
import { DESKTOP_LUCIDE } from '../../constants';
import {
	DesktopAppButton,
	DesktopProductStatePanel,
} from '../DesktopAppChrome';
import { AppStoreEmptyCatalogPanel } from '../AppStoreEmptyCatalogPanel';
import { AppStoreFeaturedRow } from '../AppStoreFeaturedRow';
import { AppStoreRecentlyViewedRow } from '../AppStoreRecentlyViewedRow';
import { AppStoreSectionPanel } from '../AppStoreSectionPanel';
import { categoryLabel, storeSectionIcon } from './appStoreCategories';
import type { StoreCategoryDef, StoreViewFilter } from './appStoreCatalogTypes';
import { formatAppsCount } from './appStoreCatalogSort';

const APP_STORE_SKELETON_KEYS = [
	'sk-0',
	'sk-1',
	'sk-2',
	'sk-3',
	'sk-4',
	'sk-5',
] as const;

export type AppStoreCatalogSectionsProps = {
	isLoading: boolean;
	catalogError?: Error | null;
	embeddedMobileLayout?: boolean;
	filteredApps: StoreAppResponse[];
	activeCategory: string | 'all';
	debouncedSearch: string;
	viewFilter: StoreViewFilter;
	filtersActive: boolean;
	suggestedEmptyCategories: ReadonlyArray<{
		id: string;
		label: string;
		count: number;
	}>;
	onClearFilters: () => void;
	onSelectCategory: (categoryId: string) => void;
	onClearSearch: () => void;
	onCatalogRetry?: () => void | Promise<void>;
	featuredApps: StoreAppResponse[];
	recentlyViewedApps: StoreAppResponse[];
	sortedCategories: string[];
	appsByCategory: Map<string, StoreAppResponse[]>;
	storeCategories: StoreCategoryDef[];
	categoryHintText: (categoryId: string) => string;
	catalogGridClass: string;
	contentPanel: string;
	sectionPanelShadow: string;
	statusChip: string;
	defaultIconsMap: Map<string, ReactNode>;
	iconStyle: DesktopIconStyle;
	reduceMotion: boolean;
	onAppClick: (appId: string) => void;
	renderAppCard: (app: StoreAppResponse) => ReactElement;
	t: TFunction<'appStore'>;
};

export function AppStoreCatalogSections({
	isLoading,
	catalogError = null,
	embeddedMobileLayout = false,
	filteredApps,
	activeCategory,
	debouncedSearch,
	viewFilter,
	filtersActive,
	suggestedEmptyCategories,
	onClearFilters,
	onSelectCategory,
	onClearSearch,
	onCatalogRetry,
	featuredApps,
	recentlyViewedApps,
	sortedCategories,
	appsByCategory,
	storeCategories,
	categoryHintText,
	catalogGridClass,
	contentPanel,
	sectionPanelShadow,
	statusChip,
	defaultIconsMap,
	iconStyle,
	reduceMotion,
	onAppClick,
	renderAppCard,
	t,
}: AppStoreCatalogSectionsProps): ReactElement {
	if (isLoading) {
		return (
			<div className="space-y-8 py-2 md:space-y-10">
				<DesktopProductStatePanel
					state="loading"
					icon={<Spinner size="lg" color="blue" type="spin" />}
					title={t('loading.catalog')}
					className={cn(
						'min-h-0 gap-2 rounded-(--desktop-radius-frame) border border-(--desktop-border-subtle)/60 px-3 py-2.5',
						contentPanel,
						sectionPanelShadow
					)}
					role="status"
					aria-busy="true"
					aria-label={t('loading.catalog')}
				/>
				<div className={catalogGridClass}>
					{APP_STORE_SKELETON_KEYS.map((skKey) => (
						<div
							key={skKey}
							className={cn(
								'overflow-hidden rounded-(--desktop-radius-frame) border border-(--desktop-border-subtle)/60',
								contentPanel,
								sectionPanelShadow
							)}
						>
							<div className="h-20 motion-safe:animate-pulse motion-reduce:animate-none bg-(--desktop-surface-soft) sm:h-24" />
							<div className="space-y-3 px-4 pb-4 pt-0">
								<div className="-mt-6 flex gap-3">
									<div className="h-14 w-14 shrink-0 motion-safe:animate-pulse motion-reduce:animate-none rounded-xl bg-(--desktop-surface-soft) ring-2 ring-[rgb(var(--desktop-fg-primary-rgb)/0.06)]" />
									<div className="flex flex-1 flex-col gap-2 pt-1">
										<div className="h-4 w-3/5 max-w-[140px] motion-safe:animate-pulse motion-reduce:animate-none rounded-md bg-(--desktop-surface-soft)" />
										<div className="h-3 w-2/5 max-w-[96px] motion-safe:animate-pulse motion-reduce:animate-none rounded-md bg-(--desktop-surface-soft)/80" />
									</div>
								</div>
								<div className="h-9 w-full motion-safe:animate-pulse motion-reduce:animate-none rounded-lg bg-(--desktop-surface-soft)/90" />
								<div className="h-9 w-full motion-safe:animate-pulse motion-reduce:animate-none rounded-lg bg-(--desktop-surface-soft)/70" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (catalogError && filteredApps.length === 0) {
		return (
			<DesktopProductStatePanel
				state="error"
				title={t('error.catalogLoad')}
				className={cn(
					'border border-dashed border-red-400/35',
					contentPanel,
					sectionPanelShadow
				)}
				actions={
					onCatalogRetry ? (
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={() => void onCatalogRetry()}
						>
							{t('error.catalogRetry')}
						</DesktopAppButton>
					) : null
				}
			/>
		);
	}

	if (filteredApps.length === 0) {
		return (
			<AppStoreEmptyCatalogPanel
				t={t}
				activeCategory={activeCategory}
				debouncedSearch={debouncedSearch}
				viewFilter={viewFilter}
				filtersActive={filtersActive}
				suggestedCategories={suggestedEmptyCategories}
				onClearFilters={onClearFilters}
				onSelectCategory={onSelectCategory}
				onClearSearch={onClearSearch}
				panelId={
					activeCategory !== 'all'
						? `store-category-${activeCategory}`
						: undefined
				}
			/>
		);
	}

	if (activeCategory === 'all') {
		const showDiscoveryRows = !embeddedMobileLayout;
		return (
			<div className="space-y-10 md:space-y-11">
				{showDiscoveryRows && featuredApps.length > 0 ? (
					<AppStoreFeaturedRow
						apps={featuredApps}
						defaultIcons={defaultIconsMap}
						iconStyle={iconStyle}
						reduceMotion={reduceMotion}
						onAppClick={onAppClick}
					/>
				) : null}
				{showDiscoveryRows &&
				!filtersActive &&
				recentlyViewedApps.length > 0 ? (
					<AppStoreRecentlyViewedRow
						apps={recentlyViewedApps}
						defaultIcons={defaultIconsMap}
						iconStyle={iconStyle}
						onAppClick={onAppClick}
					/>
				) : null}
				{sortedCategories.map((cat, sectionIndex) => {
					const list = appsByCategory.get(cat) ?? [];
					const SectionIcon = storeSectionIcon(cat, storeCategories);
					const hint = categoryHintText(cat);
					return (
						<m.div
							key={cat}
							id={`store-category-${cat}`}
							className="scroll-mt-4 as-section-root"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2, delay: sectionIndex * 0.03 }}
						>
							<AppStoreSectionPanel
								bare
								title={categoryLabel(cat, t)}
								description={hint || undefined}
								icon={
									<SectionIcon
										width={16}
										height={16}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								}
								count={
									<span className={cn(statusChip, 'tabular-nums')}>
										{formatAppsCount(list.length, t)}
									</span>
								}
							>
								<div className={catalogGridClass}>
									{list.map((app) => renderAppCard(app))}
								</div>
							</AppStoreSectionPanel>
						</m.div>
					);
				})}
			</div>
		);
	}

	return (
		<div
			id={`store-category-${activeCategory}`}
			className="scroll-mt-4 as-section-root space-y-4"
		>
			<AppStoreSectionPanel
				bare
				title={categoryLabel(activeCategory, t)}
				description={categoryHintText(activeCategory) || undefined}
				icon={(() => {
					const SectionIcon = storeSectionIcon(activeCategory, storeCategories);
					return (
						<SectionIcon
							width={16}
							height={16}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					);
				})()}
				count={
					<span className={cn(statusChip, 'tabular-nums')}>
						{formatAppsCount(filteredApps.length, t)}
					</span>
				}
			>
				<div className={catalogGridClass}>
					{filteredApps.map((app) => renderAppCard(app))}
				</div>
			</AppStoreSectionPanel>
		</div>
	);
}
