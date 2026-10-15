/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search and dropdown filters for UGS Hub task lists (status, category, provider).
 *
 * Invariants:
 * - Uses `useUgsHubShellTheme` — render only inside `UgsHubShellThemeProvider`.
 * - Visible copy comes from `ugsHub` i18n (`taskFilters.*`).
 *
 * Related:
 * - components/UGS/hub/shell/UgsHubFiltersSection.tsx, ugsHubSharedUi.tsx
 */

import { FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { useUgsHubShellTheme } from './hub/ugsHubShellThemeContext';
import {
	ugsHubEyebrowClasses,
	ugsHubFilterActiveChipClasses,
	ugsHubFilterResetBtnClasses,
	ugsHubFilterSchemeClass,
	ugsHubFilterSearchFieldClasses,
	ugsHubTextMuted,
} from './hub/ugsHubSharedUi';

export interface StatusFilterOption {
	value: string;
	label: string;
}

interface UGSTaskFiltersProps {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	statusFilter: string;
	onStatusFilterChange: (value: string) => void;
	/** Options for the status dropdown (e.g. from STATUS_FILTER_OPTIONS in parent). */
	statusOptions: StatusFilterOption[];
	categoryFilter: string;
	onCategoryFilterChange: (value: string) => void;
	providerFilter: string;
	onProviderFilterChange: (value: string) => void;
	filtersApplied: boolean;
	onResetFilters: () => void;
	availableCategories: string[];
	availableProviders: string[];
	/** Optional labels for category values (e.g. from CATEGORY_META). */
	categoryLabelMap?: Record<string, string>;
	/** Optional friendly labels for provider filter values (internal name → display). */
	providerLabelMap?: Record<string, string>;
	/** When true, omits outer section spacing (used inside UgsHubFiltersPanel). */
	embedded?: boolean;
}

const UGSTaskFilters: React.FC<UGSTaskFiltersProps> = ({
	searchQuery,
	onSearchChange,
	statusFilter,
	onStatusFilterChange,
	statusOptions,
	categoryFilter,
	onCategoryFilterChange,
	providerFilter,
	onProviderFilterChange,
	filtersApplied,
	onResetFilters,
	availableCategories,
	availableProviders,
	categoryLabelMap,
	providerLabelMap,
	embedded = false,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const statusLabel =
		statusOptions.find((option) => option.value === statusFilter)?.label ??
		statusFilter;
	const categoryLabel =
		categoryFilter === 'all'
			? null
			: (categoryLabelMap?.[categoryFilter] ?? categoryFilter);
	const providerLabel =
		providerFilter === 'all'
			? null
			: (providerLabelMap?.[providerFilter] ?? providerFilter);
	const searchChip = searchQuery.trim();
	const searchChipDisplay =
		searchChip.length > 28 ? `${searchChip.slice(0, 28)}…` : searchChip;

	return (
		<section
			className={cn(
				embedded ? 'space-y-4' : 'mb-8 space-y-4',
				ugsHubFilterSchemeClass(theme)
			)}
		>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div className="relative">
					<MagnifyingGlassIcon
						className={cn(
							'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
							ugsHubTextMuted(theme)
						)}
					/>
					<input
						id="ugs-hub-search"
						name="ugs-hub-search"
						aria-label={t('taskFilters.searchAria')}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={t('taskFilters.searchPlaceholder')}
						className={ugsHubFilterSearchFieldClasses(theme)}
					/>
				</div>

				<div>
					<label
						htmlFor="ugs-hub-status"
						className={cn('mb-1 block', ugsHubEyebrowClasses(theme))}
					>
						{t('taskFilters.statusLabel')}
					</label>
					<DesktopNativeSelect
						id="ugs-hub-status"
						name="ugs-hub-status"
						aria-label={t('taskFilters.statusAria')}
						value={statusFilter}
						onChange={(e) => onStatusFilterChange(e.target.value)}
						className="text-sm font-medium"
					>
						{statusOptions.map((option) => (
							<option
								key={option.value}
								value={option.value}
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{option.label}
							</option>
						))}
					</DesktopNativeSelect>
				</div>

				<div>
					<label
						htmlFor="ugs-hub-category"
						className={cn('mb-1 block', ugsHubEyebrowClasses(theme))}
					>
						{t('taskFilters.categoryLabel')}
					</label>
					<DesktopNativeSelect
						id="ugs-hub-category"
						name="ugs-hub-category"
						aria-label={t('taskFilters.categoryAria')}
						value={categoryFilter}
						onChange={(e) => onCategoryFilterChange(e.target.value)}
						className="text-sm font-medium"
					>
						{availableCategories.map((category) => (
							<option
								key={category}
								value={category}
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{category === 'all'
									? t('taskFilters.categoryAll')
									: (categoryLabelMap?.[category] ?? category)}
							</option>
						))}
					</DesktopNativeSelect>
				</div>

				<div>
					<label
						htmlFor="ugs-hub-provider"
						className={cn('mb-1 block', ugsHubEyebrowClasses(theme))}
					>
						{t('taskFilters.channelLabel')}
					</label>
					<DesktopNativeSelect
						id="ugs-hub-provider"
						name="ugs-hub-provider"
						aria-label={t('taskFilters.channelAria')}
						value={providerFilter}
						onChange={(e) => onProviderFilterChange(e.target.value)}
						className="text-sm font-medium"
					>
						<option
							value="all"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('taskFilters.channelAll')}
						</option>
						{availableProviders
							.filter((p) => p !== 'all')
							.map((provider) => (
								<option
									key={provider}
									value={provider}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{providerLabelMap?.[provider] ?? provider}
								</option>
							))}
					</DesktopNativeSelect>
				</div>
			</div>

			{filtersApplied ? (
				<div className="flex flex-wrap items-center gap-2 border-t border-(--desktop-border-subtle) pt-3">
					<span className={cn('text-xs', ugsHubTextMuted(theme))}>
						{t('taskFilters.activeFilters')}
					</span>
					{searchChip ? (
						<span
							className={ugsHubFilterActiveChipClasses(theme)}
							title={searchChip}
						>
							{t('taskFilters.chipSearch', { query: searchChipDisplay })}
						</span>
					) : null}
					{statusFilter !== 'all' ? (
						<span className={ugsHubFilterActiveChipClasses(theme)}>
							{t('taskFilters.chipStatus', { label: statusLabel })}
						</span>
					) : null}
					{categoryLabel ? (
						<span className={ugsHubFilterActiveChipClasses(theme)}>
							{t('taskFilters.chipCategory', { label: categoryLabel })}
						</span>
					) : null}
					{providerLabel ? (
						<span className={ugsHubFilterActiveChipClasses(theme)}>
							{t('taskFilters.chipChannel', { label: providerLabel })}
						</span>
					) : null}
					<button
						type="button"
						onClick={onResetFilters}
						className={ugsHubFilterResetBtnClasses(theme)}
					>
						<FunnelIcon className="h-3 w-3" />
						{t('taskFilters.reset')}
					</button>
				</div>
			) : null}
		</section>
	);
};

export default UGSTaskFilters;
