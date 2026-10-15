/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store catalog column composition — sidebar + main scroll (hero, jump nav,
 * install status, filters bar, sections, scroll FAB).
 *
 * Invariants:
 * - Filter/catalog derived state comes from useAppStoreCatalogState; install and
 *   shell class strings are injected by AppStore orchestrator.
 *
 * Related:
 * - AppStore.tsx, useAppStoreCatalogState.ts, AppStoreCatalogSidebar.tsx
 */

import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import type { DesktopIconStyle } from '@/types/profile';
import type { StoreAppResponse } from '../../services/desktopApi';
import { AppStoreActiveFiltersBar } from '../AppStoreActiveFiltersBar';
import { AppStoreCategoryJumpNav } from '../AppStoreCategoryJumpNav';
import { AppStoreScrollToTopFab } from '../AppStoreScrollToTopFab';
import { categoryLabel } from './appStoreCategories';
import type { AppStoreInstallStatus } from './appStoreInstallTypes';
import { AppStoreCatalogInstallStatus } from './AppStoreInstallProgress';
import { AppStoreCatalogSections } from './AppStoreCatalogSections';
import { AppStoreCatalogSidebar } from './AppStoreCatalogSidebar';
import {
	AppStoreMobileCatalogBar,
	AppStorePremiumStorefrontHero,
} from './AppStoreHeroSearchCluster';
import type { UseAppStoreCatalogStateResult } from './useAppStoreCatalogState';

const MAIN_SCROLL_CLASS =
	'relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-gutter-stable px-4 py-6 sm:px-7 sm:py-8';

export type AppStoreCatalogBodyProps = {
	t: TFunction<'appStore'>;
	variant: 'modal' | 'page';
	embeddedMobileLayout: boolean;
	isLoading: boolean;
	isBusy: boolean;
	catalogError?: Error | null;
	onCatalogRetry?: () => void | Promise<void>;
	apps: StoreAppResponse[];
	installStatus: AppStoreInstallStatus;
	iconStyle: DesktopIconStyle;
	reduceMotion: boolean;
	renderAppCard: (app: StoreAppResponse) => ReactElement;
	catalog: UseAppStoreCatalogStateResult;
	/** Shell class strings from AppStore orchestrator. */
	storeNavAsideClass: string;
	storeCategoryNavClass: string;
	catalogGridClass: string;
	contentPanel: string;
	sectionPanelShadow: string;
	statusChip: string;
	filterStrip: string;
	sidebarNavRow: string;
	sidebarNavIcon: string;
	mainColumnBg: string;
	premiumHeroClass: string;
	premiumMetricCard: string;
};

export function AppStoreCatalogBody({
	t,
	variant,
	embeddedMobileLayout,
	isLoading,
	isBusy,
	catalogError = null,
	onCatalogRetry,
	apps,
	installStatus,
	iconStyle,
	reduceMotion,
	renderAppCard,
	catalog,
	storeNavAsideClass,
	storeCategoryNavClass,
	catalogGridClass,
	contentPanel,
	sectionPanelShadow,
	statusChip,
	filterStrip,
	sidebarNavRow,
	sidebarNavIcon,
	mainColumnBg,
	premiumHeroClass,
	premiumMetricCard,
}: AppStoreCatalogBodyProps): ReactElement {
	const {
		mainScrollRef,
		activeCategory,
		viewFilter,
		sortMode,
		debouncedSearch,
		filtersActive,
		filteredApps,
		appsByCategory,
		sortedCategories,
		storeCategories,
		visibleStoreCategories,
		categoryTotals,
		installedCount,
		availableCount,
		featuredApps,
		recentlyViewedApps,
		suggestedEmptyCategories,
		categoryJumpItems,
		defaultIconsMap,
		clearStoreFilters,
		clearSearchQuery,
		clearActiveCategory,
		selectViewFilterAll,
		selectSortCatalog,
		selectCategoryById,
		handleCategoryNavClick,
		handleAppNavigate,
		categoryHintText,
	} = catalog;

	const appsCount = apps.length;

	return (
		<div
			className={cn(
				'flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent',
				!embeddedMobileLayout && 'lg:flex-row'
			)}
		>
			<AppStoreCatalogSidebar
				t={t}
				variant={variant}
				embeddedMobileLayout={embeddedMobileLayout}
				asideClassName={storeNavAsideClass}
				isLoading={isLoading}
				appsCount={appsCount}
				filterStrip={filterStrip}
				storeCategoryNavClass={storeCategoryNavClass}
				activeCategory={activeCategory}
				onCategoryNavClick={handleCategoryNavClick}
				visibleStoreCategories={visibleStoreCategories}
				categoryHintText={categoryHintText}
				categoryTotals={categoryTotals}
				sidebarNavRow={sidebarNavRow}
				sidebarNavIcon={sidebarNavIcon}
				contentPanel={contentPanel}
				sectionPanelShadow={sectionPanelShadow}
				installedCount={installedCount}
				availableCount={availableCount}
			/>
			<div
				data-as-guide="catalog"
				className={cn(
					'relative flex min-h-0 min-w-0 flex-1 flex-col',
					mainColumnBg
				)}
			>
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<main
						ref={mainScrollRef}
						className={MAIN_SCROLL_CLASS}
						aria-label={t('mainList')}
						aria-busy={isLoading || isBusy ? 'true' : 'false'}
					>
						{!isLoading ? (
							<AppStoreMobileCatalogBar
								t={t}
								embeddedMobileLayout={embeddedMobileLayout}
								activeCategory={activeCategory}
								filteredAppsCount={filteredApps.length}
								appsCount={appsCount}
								filtersActive={filtersActive}
								categoryHintText={categoryHintText}
								onClearFilters={clearStoreFilters}
							/>
						) : null}
						{!filtersActive && activeCategory === 'all' ? (
							<AppStorePremiumStorefrontHero
								t={t}
								embeddedMobileLayout={embeddedMobileLayout}
								premiumHeroClass={premiumHeroClass}
								premiumMetricCard={premiumMetricCard}
								installedCount={installedCount}
								availableCount={availableCount}
								visibleStoreCategories={visibleStoreCategories}
							/>
						) : null}
						{!isLoading &&
						!filtersActive &&
						activeCategory === 'all' &&
						categoryJumpItems.length >= 2 ? (
							<AppStoreCategoryJumpNav
								t={t}
								categories={categoryJumpItems}
								variant="mobile"
							/>
						) : null}
						<AppStoreCatalogInstallStatus
							t={t}
							apps={apps}
							installStatus={installStatus}
							isLoading={isLoading}
						/>
						{!isLoading && filtersActive ? (
							<AppStoreActiveFiltersBar
								t={t}
								debouncedSearch={debouncedSearch}
								activeCategory={activeCategory}
								activeCategoryLabel={
									activeCategory === 'all'
										? t('nav.all')
										: categoryLabel(activeCategory, t)
								}
								viewFilter={viewFilter}
								sortMode={sortMode}
								onClearSearch={clearSearchQuery}
								onClearCategory={clearActiveCategory}
								onClearViewFilter={selectViewFilterAll}
								onClearSort={selectSortCatalog}
								onClearAll={clearStoreFilters}
							/>
						) : null}
						{!isLoading &&
						!filtersActive &&
						activeCategory === 'all' &&
						categoryJumpItems.length >= 2 &&
						!embeddedMobileLayout ? (
							<AppStoreCategoryJumpNav t={t} categories={categoryJumpItems} />
						) : null}
						<AppStoreCatalogSections
							isLoading={isLoading}
							catalogError={catalogError}
							embeddedMobileLayout={embeddedMobileLayout}
							filteredApps={filteredApps}
							activeCategory={activeCategory}
							debouncedSearch={debouncedSearch}
							viewFilter={viewFilter}
							filtersActive={filtersActive}
							suggestedEmptyCategories={suggestedEmptyCategories}
							onClearFilters={clearStoreFilters}
							onSelectCategory={selectCategoryById}
							onClearSearch={clearSearchQuery}
							onCatalogRetry={onCatalogRetry}
							featuredApps={featuredApps}
							recentlyViewedApps={recentlyViewedApps}
							sortedCategories={sortedCategories}
							appsByCategory={appsByCategory}
							storeCategories={storeCategories}
							categoryHintText={categoryHintText}
							catalogGridClass={catalogGridClass}
							contentPanel={contentPanel}
							sectionPanelShadow={sectionPanelShadow}
							statusChip={statusChip}
							defaultIconsMap={defaultIconsMap}
							iconStyle={iconStyle}
							reduceMotion={reduceMotion}
							onAppClick={handleAppNavigate}
							renderAppCard={renderAppCard}
							t={t}
						/>
					</main>
					<AppStoreScrollToTopFab
						scrollRef={mainScrollRef}
						t={t}
						reduceMotion={reduceMotion}
						active={!isLoading}
					/>
				</div>
			</div>
		</div>
	);
}
