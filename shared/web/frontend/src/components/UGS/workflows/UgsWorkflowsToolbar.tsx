/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Title row, refresh/import/create actions, and search/filter/sort controls for UGS Workflows tab.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - useUgsWorkflowsTabController.ts
 * - ugsWorkflowsSharedUi.ts
 */

import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	FunnelIcon,
	MagnifyingGlassIcon,
	SignalIcon,
} from '@heroicons/react/24/outline';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopNativeSelect,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useUgsHubShellTheme } from '../hub/ugsHubShellThemeContext';
import type { UgsWorkflowsTabController } from './useUgsWorkflowsTabController';
import type { UgsWorkflowsSortBy } from './ugsWorkflowsFilterUtils';
import {
	ugsHubTextMuted,
	ugsHubTextPrimary,
	workflowsCompactBtnClasses,
	workflowsFilterActiveChipClasses,
	workflowsFilterResetBtnClasses,
	workflowsFilterSchemeClass,
	workflowsSearchFieldClasses,
	workflowsToolbarPanelClasses,
} from './ugsWorkflowsSharedUi';
import { cn } from './utils';

export interface UgsWorkflowsToolbarProps {
	controller: UgsWorkflowsTabController;
}

export function UgsWorkflowsToolbar({
	controller,
}: UgsWorkflowsToolbarProps): ReactElement {
	const { t } = useTranslation('ugsHub');
	const shellTheme = useUgsHubShellTheme();
	const {
		workflows,
		filteredWorkflows,
		availableProjects,
		autoRefreshEnabled,
		toggleAutoRefresh,
		isRefreshing,
		handleRefresh,
		handleImport,
		searchQuery,
		setSearchQuery,
		filterPublic,
		setFilterPublic,
		filterProject,
		setFilterProject,
		sortBy,
		setSortBy,
		filtersApplied,
		resetWorkflowFilters,
	} = controller;

	const filteredCount = filteredWorkflows.length;
	const totalCount = workflows.length;
	const searchChip = searchQuery.trim();
	const searchChipDisplay =
		searchChip.length > 28 ? `${searchChip.slice(0, 28)}…` : searchChip;

	return (
		<>
			<div
				className={cn(
					workflowsToolbarPanelClasses(shellTheme),
					'flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3'
				)}
			>
				<div className="min-w-0">
					<h3
						className={cn(
							'truncate text-base font-semibold',
							ugsHubTextPrimary(shellTheme)
						)}
					>
						{t('workflows.title')}{' '}
						<span
							className={cn(
								'font-normal tabular-nums',
								ugsHubTextMuted(shellTheme)
							)}
						>
							{filteredCount !== totalCount
								? t('workflows.titleCountFiltered', {
										filtered: filteredCount,
										total: totalCount,
									})
								: t('workflows.titleCount', { count: filteredCount })}
						</span>
					</h3>
					<p className="sr-only">{t('workflows.srDescription')}</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
					<button
						type="button"
						onClick={toggleAutoRefresh}
						className={workflowsCompactBtnClasses(
							shellTheme,
							autoRefreshEnabled ? 'autoOn' : 'autoOff'
						)}
						title={
							autoRefreshEnabled
								? t('workflows.autoOnTitle')
								: t('workflows.autoOffTitle')
						}
					>
						<SignalIcon
							width={13}
							height={13}
							className={autoRefreshEnabled ? 'animate-pulse' : ''}
							aria-hidden
						/>
						{autoRefreshEnabled
							? t('workflows.autoOn')
							: t('workflows.autoOff')}
					</button>
					<button
						type="button"
						onClick={() => {
							void handleRefresh();
						}}
						disabled={isRefreshing}
						className={cn(
							workflowsCompactBtnClasses(shellTheme),
							'disabled:cursor-not-allowed disabled:opacity-50'
						)}
					>
						<ArrowPathIcon
							className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
							aria-hidden
						/>
						{t('workflows.refresh')}
					</button>
					<button
						type="button"
						onClick={handleImport}
						className={workflowsCompactBtnClasses(shellTheme, 'import')}
					>
						<ArrowUpTrayIcon width={13} height={13} aria-hidden />
						{t('workflows.import')}
					</button>
				</div>
			</div>

			<div
				className={cn(
					'flex flex-wrap items-end gap-2',
					workflowsFilterSchemeClass(shellTheme)
				)}
			>
				<div className="relative min-w-[min(100%,200px)] flex-2 basis-[min(100%,280px)]">
					<MagnifyingGlassIcon
						className={cn(
							'pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
							ugsHubTextMuted(shellTheme)
						)}
					/>
					<input
						id="ugs-workflows-search"
						name="ugs-workflows-search"
						aria-label={t('workflows.searchAria')}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t('workflows.searchPlaceholder')}
						className={workflowsSearchFieldClasses(shellTheme)}
					/>
				</div>
				<div className="min-w-[min(100%,120px)] flex-1 basis-[140px]">
					<DesktopNativeSelect
						id="ugs-workflows-visibility"
						name="ugs-workflows-visibility"
						aria-label={t('workflows.visibilityAria')}
						value={filterPublic}
						onChange={(e) => setFilterPublic(e.target.value)}
						className="min-h-9 min-w-0 text-sm"
					>
						<option
							value="all"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('workflows.visibilityAll')}
						</option>
						<option
							value="public"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('workflows.visibilityPublic')}
						</option>
						<option
							value="private"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('workflows.visibilityPrivate')}
						</option>
					</DesktopNativeSelect>
				</div>
				{availableProjects.length > 0 && (
					<div className="min-w-[min(100%,120px)] flex-1 basis-[140px]">
						<DesktopNativeSelect
							id="ugs-workflows-project"
							name="ugs-workflows-project"
							aria-label={t('workflows.projectAria')}
							value={filterProject}
							onChange={(e) => setFilterProject(e.target.value)}
							className="min-h-9 min-w-0 text-sm"
						>
							<option
								value="all"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('workflows.projectAll')}
							</option>
							{availableProjects.map((projectId) => (
								<option
									key={projectId}
									value={projectId}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{projectId.slice(0, 8)}...
								</option>
							))}
						</DesktopNativeSelect>
					</div>
				)}
				<div className="min-w-[min(100%,120px)] flex-1 basis-[140px]">
					<DesktopNativeSelect
						id="ugs-workflows-sort"
						name="ugs-workflows-sort"
						aria-label={t('workflows.sortAria')}
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as UgsWorkflowsSortBy)}
						className="min-h-9 min-w-0 text-sm"
					>
						<option
							value="date"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('workflows.sortDate')}
						</option>
						<option
							value="name"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('workflows.sortName')}
						</option>
						<option
							value="executions"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('workflows.sortExecutions')}
						</option>
					</DesktopNativeSelect>
				</div>
			</div>

			{filtersApplied ? (
				<div className="flex flex-wrap items-center gap-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 px-3 py-2">
					<span className={cn('text-xs', ugsHubTextMuted(shellTheme))}>
						{t('workflows.activeFilters')}
					</span>
					{searchChip ? (
						<span
							className={workflowsFilterActiveChipClasses(shellTheme)}
							title={searchChip}
						>
							{t('workflows.chipSearch', { query: searchChipDisplay })}
						</span>
					) : null}
					{filterPublic !== 'all' ? (
						<span className={workflowsFilterActiveChipClasses(shellTheme)}>
							{filterPublic === 'public'
								? t('workflows.visibilityPublic')
								: t('workflows.visibilityPrivate')}
						</span>
					) : null}
					{filterProject !== 'all' ? (
						<span className={workflowsFilterActiveChipClasses(shellTheme)}>
							{t('workflows.chipProject', { id: filterProject.slice(0, 8) })}
						</span>
					) : null}
					<button
						type="button"
						onClick={resetWorkflowFilters}
						className={workflowsFilterResetBtnClasses(shellTheme)}
					>
						<FunnelIcon className="h-3 w-3" aria-hidden />
						{t('workflows.reset')}
					</button>
				</div>
			) : null}
		</>
	);
}
