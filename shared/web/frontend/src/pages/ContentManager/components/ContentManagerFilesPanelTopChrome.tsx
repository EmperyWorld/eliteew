/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium-dense toolbar above the Content Manager files grid: browse scope, sort,
 * and progressively disclosed view/filter/selection tools.
 *
 * Invariants:
 * - List-source controls reset pagination when switching scope.
 * - Toolbar labels must describe the same selection scope as the selection bar.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `contentManagerFilesChromeTokens.ts`
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopNativeSelect,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import type { ContentManagerEditFolderOption } from './ContentManagerEditModal';
import { TYPE_CONFIG } from './ContentManagerTypeConfig';
import type {
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
	SortField,
	SortOrder,
	ViewMode,
} from '../contentManagerTypes';
import { CONTENT_MANAGER_FILES_CHROME } from '../contentManagerFilesChromeTokens';
import type { AutoSortScope } from '../sortToSystemFolders';
import type {
	TenancyCompany,
	TenancyProject,
} from '../hooks/useTenancyOptions';
import {
	ArrowPathIcon,
	Bars3BottomLeftIcon,
	EllipsisHorizontalIcon,
	FolderIcon,
	FolderOpenIcon,
	FunnelIcon,
	ListBulletIcon,
	RectangleStackIcon,
	Squares2X2Icon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const BROWSE_MODES: ReadonlyArray<{
	mode: FilesBrowseMode;
	id: string;
	icon: typeof Bars3BottomLeftIcon;
	labelKey:
		| 'files.browseMode.explorer'
		| 'files.browseMode.catalog'
		| 'files.browseMode.allFiles';
}> = [
	{
		mode: 'explorer',
		id: 'content-manager-browse-explorer',
		icon: Bars3BottomLeftIcon,
		labelKey: 'files.browseMode.explorer',
	},
	{
		mode: 'catalog',
		id: 'content-manager-browse-catalog',
		icon: FolderOpenIcon,
		labelKey: 'files.browseMode.catalog',
	},
	{
		mode: 'all_files',
		id: 'content-manager-browse-all-files',
		icon: RectangleStackIcon,
		labelKey: 'files.browseMode.allFiles',
	},
];

const SORT_OPTIONS: ReadonlyArray<{
	value: `${SortField}-${SortOrder}`;
	field: SortField;
	order: SortOrder;
	labelKey:
		| 'files.filters.sortNew'
		| 'files.filters.sortCreatedNew'
		| 'files.filters.sortOld'
		| 'files.filters.sortNameAsc'
		| 'files.filters.sortNameDesc'
		| 'files.filters.sortSizeDesc'
		| 'files.filters.sortSizeAsc'
		| 'files.filters.sortType';
}> = [
	{
		value: 'updated_at-desc',
		field: 'updated_at',
		order: 'desc',
		labelKey: 'files.filters.sortNew',
	},
	{
		value: 'created_at-desc',
		field: 'created_at',
		order: 'desc',
		labelKey: 'files.filters.sortCreatedNew',
	},
	{
		value: 'created_at-asc',
		field: 'created_at',
		order: 'asc',
		labelKey: 'files.filters.sortOld',
	},
	{
		value: 'name-asc',
		field: 'name',
		order: 'asc',
		labelKey: 'files.filters.sortNameAsc',
	},
	{
		value: 'name-desc',
		field: 'name',
		order: 'desc',
		labelKey: 'files.filters.sortNameDesc',
	},
	{
		value: 'file_size-desc',
		field: 'file_size',
		order: 'desc',
		labelKey: 'files.filters.sortSizeDesc',
	},
	{
		value: 'file_size-asc',
		field: 'file_size',
		order: 'asc',
		labelKey: 'files.filters.sortSizeAsc',
	},
	{
		value: 'content_type-asc',
		field: 'content_type',
		order: 'asc',
		labelKey: 'files.filters.sortType',
	},
];

export interface ContentManagerFilesPanelTopChromeProps {
	/** Вкладки разделов (иконки) — рендерит родитель через `ContentManagerTabStrip` `railIconRow`. */
	panelTabsSlot?: React.ReactNode;
	shellContentPanelClass: string;
	filesBrowseMode: FilesBrowseMode;
	cabinetLocked: boolean;
	filterFolderId: string | null;
	setFilterFolderId: React.Dispatch<React.SetStateAction<string | null>>;
	folders: ContentManagerEditFolderOption[];
	filterCompanyId: string | null;
	setFilterCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	companies: TenancyCompany[];
	loadingCompanies: boolean;
	filterProjectId: string | null;
	setFilterProjectId: React.Dispatch<React.SetStateAction<string | null>>;
	projects: TenancyProject[];
	loadingProjects: boolean;
	filterType: string;
	setFilterType: React.Dispatch<React.SetStateAction<string>>;
	filterVisibility: FilterVisibility;
	setFilterVisibility: React.Dispatch<React.SetStateAction<FilterVisibility>>;
	groupBy: GroupBy;
	setGroupBy: React.Dispatch<React.SetStateAction<GroupBy>>;
	sortField: SortField;
	sortOrder: SortOrder;
	setSortField: React.Dispatch<React.SetStateAction<SortField>>;
	setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
	showFilters: boolean;
	setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
	hasActiveListFilters: boolean;
	onResetListFilters?: () => void;
	viewMode: ViewMode;
	setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
	selectMode: boolean;
	setSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
	selectedIds: ReadonlySet<string>;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	filteredItems: ReadonlyArray<{ id: string }>;
	selectAll: () => void;
	loading: boolean;
	setFilesBrowseMode: React.Dispatch<React.SetStateAction<FilesBrowseMode>>;
	autoSortBusy: boolean;
	runAutoSortToSystemFolders: (scope: AutoSortScope) => void | Promise<void>;
}

export const ContentManagerFilesPanelTopChrome: React.FC<
	ContentManagerFilesPanelTopChromeProps
> = ({
	panelTabsSlot,
	shellContentPanelClass,
	filesBrowseMode,
	cabinetLocked,
	filterFolderId,
	setFilterFolderId,
	folders,
	filterCompanyId,
	setFilterCompanyId,
	companies,
	loadingCompanies,
	filterProjectId,
	setFilterProjectId,
	projects,
	loadingProjects,
	filterType,
	setFilterType,
	filterVisibility,
	setFilterVisibility,
	groupBy,
	setGroupBy,
	sortField,
	sortOrder,
	setSortField,
	setSortOrder,
	setCurrentPage,
	showFilters,
	setShowFilters,
	hasActiveListFilters,
	onResetListFilters,
	viewMode,
	setViewMode,
	selectMode,
	setSelectMode,
	setSelectedIds,
	filteredItems: _filteredItems,
	selectAll: _selectAll,
	loading,
	setFilesBrowseMode,
	autoSortBusy,
	runAutoSortToSystemFolders,
}) => {
	const { t } = useTranslation('contentManager');
	const { t: tDesktopUi } = useTranslation('desktopUi');

	const sortValue = `${sortField}-${sortOrder}` as `${SortField}-${SortOrder}`;

	const toolsActive =
		showFilters || hasActiveListFilters || selectMode || viewMode === 'list';
	const [toolsOpen, setToolsOpen] = React.useState(toolsActive);

	React.useEffect(() => {
		if (toolsActive) setToolsOpen(true);
	}, [toolsActive]);

	const handleSortChange = React.useCallback(
		(next: string) => {
			const [field, order] = next.split('-') as [SortField, SortOrder];
			setSortField(field);
			setSortOrder(order);
			setCurrentPage(1);
		},
		[setCurrentPage, setSortField, setSortOrder]
	);

	const showToolsRow = toolsOpen || toolsActive;

	return (
		<div className="flex min-w-0 shrink-0 flex-col gap-2">
			<div
				data-cm-guide="files-panel-toolbar"
				role="toolbar"
				aria-label={t('files.panelToolbar.aria')}
				className={CONTENT_MANAGER_FILES_CHROME.panelToolbar}
			>
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{panelTabsSlot ? (
						<div className="flex shrink-0 items-center gap-0.5">
							{panelTabsSlot}
						</div>
					) : null}
					{!cabinetLocked ? (
						<fieldset
							className="min-w-0 flex-1"
							aria-label={t('files.browseMode.ariaLabel')}
						>
							<div className={CONTENT_MANAGER_FILES_CHROME.segmentCluster}>
								{BROWSE_MODES.map(({ mode, id, icon: Icon, labelKey }) => {
									const active = filesBrowseMode === mode;
									return (
										<button
											key={mode}
											type="button"
											id={id}
											aria-controls="content-manager-files-panel"
											aria-pressed={active}
											onClick={() => {
												setFilesBrowseMode(mode);
												setCurrentPage(1);
											}}
											className={CONTENT_MANAGER_FILES_CHROME.segmentButton(
												active
											)}
											title={t(labelKey)}
										>
											<Icon className="h-4 w-4 shrink-0" aria-hidden />
											<span className="truncate">{t(labelKey)}</span>
										</button>
									);
								})}
							</div>
						</fieldset>
					) : null}

					<div className="ms-auto flex min-w-0 shrink-0 items-center gap-1.5">
						<label htmlFor="cm-toolbar-sort" className="sr-only">
							{t('files.toolbar.sortLabel')}
						</label>
						<DesktopNativeSelect
							id="cm-toolbar-sort"
							value={sortValue}
							onChange={(e) => handleSortChange(e.target.value)}
							aria-label={t('files.toolbar.sortLabel')}
							className="min-w-38 max-w-full"
						>
							{SORT_OPTIONS.map(({ value, labelKey }) => (
								<option
									key={value}
									value={value}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{t(labelKey)}
								</option>
							))}
						</DesktopNativeSelect>

						<DesktopAppButton
							type="button"
							onClick={() => setToolsOpen((open) => !open)}
							variant={showToolsRow ? 'neutral' : 'ghost'}
							size="sm"
							className={CONTENT_MANAGER_FILES_CHROME.toolsToggle}
							title={t('files.toolbar.tools')}
							aria-label={t('files.toolbar.toolsAria')}
							aria-expanded={showToolsRow}
							aria-controls="content-manager-panel-tools"
						>
							<EllipsisHorizontalIcon
								className="h-4 w-4 shrink-0"
								aria-hidden
							/>
							<span className="hidden sm:inline">
								{t('files.toolbar.tools')}
							</span>
						</DesktopAppButton>
					</div>
				</div>

				{showToolsRow ? (
					<div
						id="content-manager-panel-tools"
						className={CONTENT_MANAGER_FILES_CHROME.toolsRow}
					>
						<fieldset
							className={CONTENT_MANAGER_FILES_CHROME.segmentCluster}
							aria-label={t('files.toolbar.viewLabel')}
						>
							<DesktopAppButton
								type="button"
								onClick={() => setViewMode('grid')}
								variant={viewMode === 'grid' ? 'accent' : 'ghost'}
								size="sm"
								className="h-8 w-8 min-w-8 px-0"
								aria-pressed={viewMode === 'grid'}
								title={t('files.toolbar.viewGrid')}
								aria-label={t('files.toolbar.viewGrid')}
							>
								<Squares2X2Icon className="h-4 w-4" aria-hidden />
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								onClick={() => setViewMode('list')}
								variant={viewMode === 'list' ? 'accent' : 'ghost'}
								size="sm"
								className="h-8 w-8 min-w-8 px-0"
								aria-pressed={viewMode === 'list'}
								title={t('files.toolbar.viewList')}
								aria-label={t('files.toolbar.viewList')}
							>
								<ListBulletIcon className="h-4 w-4" aria-hidden />
							</DesktopAppButton>
						</fieldset>

						<DesktopAppButton
							type="button"
							onClick={() => setShowFilters(!showFilters)}
							variant={showFilters || hasActiveListFilters ? 'accent' : 'ghost'}
							size="sm"
							className="h-8 gap-1.5 px-2.5"
							title={t('files.toolbar.filters')}
							aria-label={t('files.toolbar.filters')}
							aria-expanded={showFilters}
							aria-controls="content-manager-filters-panel"
						>
							<FunnelIcon className="h-4 w-4 shrink-0" aria-hidden />
							{t('files.toolbar.filters')}
							{hasActiveListFilters ? (
								<span
									className="rounded-full bg-(--desktop-accent) px-1.5 py-px text-[10px] font-semibold leading-none text-white"
									aria-hidden
								>
									•
								</span>
							) : null}
						</DesktopAppButton>

						<DesktopAppButton
							type="button"
							onClick={() => {
								setSelectMode(!selectMode);
								if (selectMode) setSelectedIds(new Set());
							}}
							variant={selectMode ? 'accent' : 'ghost'}
							size="sm"
							className="h-8 gap-1.5 px-2.5"
							title={t('files.toolbar.select')}
							aria-pressed={selectMode}
						>
							{t(
								selectMode
									? 'files.toolbar.selectModeOn'
									: 'files.toolbar.select'
							)}
						</DesktopAppButton>
					</div>
				) : null}
			</div>

			<AnimatePresence>
				{showFilters && (
					<motion.div
						id="content-manager-filters-panel"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="min-w-0 shrink-0 overflow-hidden"
					>
						<div
							className={cn(
								shellContentPanelClass,
								'flex min-h-0 flex-col gap-4 p-4'
							)}
						>
							<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
								<DesktopAppSectionLabel className="mb-0 block px-0.5">
									{t('files.leftRail.filtersPanel')}
								</DesktopAppSectionLabel>
								{hasActiveListFilters && onResetListFilters ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 gap-1.5 px-2.5 text-(--desktop-text-secondary)"
										onClick={onResetListFilters}
									>
										<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
										{t('files.list.resetFilters')}
									</DesktopAppButton>
								) : null}
							</div>

							<div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{filesBrowseMode === 'catalog' ? (
									<div>
										<label
											htmlFor="cm-filter-folder"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('files.filters.folder')}
										</label>
										<DesktopNativeSelect
											id="cm-filter-folder"
											value={filterFolderId ?? ''}
											onChange={(e) =>
												setFilterFolderId(
													e.target.value === '' ? null : e.target.value
												)
											}
											aria-label={t('files.filters.folder')}
										>
											<option
												value=""
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('files.filters.folderAll')}
											</option>
											{folders.map((f) => (
												<option
													key={f.item_id}
													value={f.item_id}
													className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
												>
													{resolveDesktopFolderDisplayName(f, tDesktopUi)}
												</option>
											))}
										</DesktopNativeSelect>
									</div>
								) : null}
								{!cabinetLocked ? (
									<>
										<div>
											<label
												htmlFor="cm-filter-company"
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'mb-1.5 block font-medium'
												)}
											>
												{t('files.filters.company')}
											</label>
											<DesktopNativeSelect
												id="cm-filter-company"
												value={filterCompanyId ?? ''}
												onChange={(e) => {
													const v =
														e.target.value === '' ? null : e.target.value;
													setFilterCompanyId(v);
													setFilterProjectId(null);
												}}
												aria-label={t('files.filters.company')}
												disabled={loadingCompanies}
											>
												<option
													value=""
													className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
												>
													{t('files.filters.companyAll')}
												</option>
												{companies.map((c) => (
													<option
														key={c.id}
														value={c.id}
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{c.name}
													</option>
												))}
											</DesktopNativeSelect>
										</div>
										<div>
											<label
												htmlFor="cm-filter-project"
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'mb-1.5 block font-medium'
												)}
											>
												{t('files.filters.project')}
											</label>
											<DesktopNativeSelect
												id="cm-filter-project"
												value={filterProjectId ?? ''}
												onChange={(e) =>
													setFilterProjectId(
														e.target.value === '' ? null : e.target.value
													)
												}
												aria-label={t('files.filters.project')}
												disabled={!filterCompanyId || loadingProjects}
											>
												<option
													value=""
													className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
												>
													{filterCompanyId
														? t('files.filters.projectAllInCompany')
														: t('files.filters.projectNeedCompany')}
												</option>
												{projects.map((p) => (
													<option
														key={p.id}
														value={p.id}
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{p.name}
													</option>
												))}
											</DesktopNativeSelect>
										</div>
									</>
								) : null}
								<div>
									<label
										htmlFor="cm-filter-type"
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mb-1.5 block font-medium'
										)}
									>
										{t('files.filters.type')}
									</label>
									<DesktopNativeSelect
										id="cm-filter-type"
										value={filterType}
										onChange={(e) => setFilterType(e.target.value)}
										aria-label={t('files.filters.type')}
									>
										<option
											value="all"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.typeAll')}
										</option>
										{Object.keys(TYPE_CONFIG).map((k) => (
											<option
												key={k}
												value={k}
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t(`contentTypes.${k}`)}
											</option>
										))}
									</DesktopNativeSelect>
								</div>
								<div>
									<label
										htmlFor="cm-filter-visibility"
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mb-1.5 block font-medium'
										)}
									>
										{t('files.filters.visibility')}
									</label>
									<DesktopNativeSelect
										id="cm-filter-visibility"
										value={filterVisibility}
										onChange={(e) =>
											setFilterVisibility(e.target.value as FilterVisibility)
										}
										aria-label={t('files.filters.visibility')}
									>
										<option
											value="all"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.visibilityAll')}
										</option>
										<option
											value="private"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.visibilityPrivate')}
										</option>
										<option
											value="friends"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.visibilityFriends')}
										</option>
										<option
											value="from_friends"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.visibilityFromFriends')}
										</option>
										<option
											value="shared"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.visibilityShared')}
										</option>
									</DesktopNativeSelect>
								</div>
								<div>
									<label
										htmlFor="cm-filter-groupby"
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mb-1.5 block font-medium'
										)}
									>
										{t('files.filters.groupBy')}
									</label>
									<DesktopNativeSelect
										id="cm-filter-groupby"
										value={groupBy}
										onChange={(e) => setGroupBy(e.target.value as GroupBy)}
										aria-label={t('files.filters.groupBy')}
									>
										<option
											value="none"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.groupNone')}
										</option>
										<option
											value="type"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.groupType')}
										</option>
										<option
											value="date"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.groupDate')}
										</option>
										<option
											value="folder"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('files.filters.groupFolder')}
										</option>
									</DesktopNativeSelect>
								</div>
							</div>

							{!cabinetLocked ? (
								<div className="rounded-xl border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/35 p-3">
									<DesktopAppSectionLabel className="mb-1 block px-0.5">
										{t('files.leftRail.autoSortSection')}
									</DesktopAppSectionLabel>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mb-3 max-w-prose text-(--desktop-text-dim)'
										)}
									>
										{t('files.toolbar.autoSortHint')}
									</p>
									<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											className="h-9 justify-start gap-2 px-3"
											disabled={autoSortBusy || loading}
											onClick={() => void runAutoSortToSystemFolders('unfiled')}
											title={t('files.autoSort.unfiledTitle')}
										>
											{autoSortBusy ? (
												<ArrowPathIcon
													className="h-4 w-4 shrink-0 animate-spin"
													aria-hidden
												/>
											) : (
												<FolderIcon className="h-4 w-4 shrink-0" aria-hidden />
											)}
											<span className="text-left">
												{t('files.autoSort.unfiled')}
											</span>
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											className="h-9 justify-start gap-2 px-3"
											disabled={autoSortBusy || loading}
											onClick={() =>
												void runAutoSortToSystemFolders('content_folder')
											}
											title={t('files.autoSort.contentFolderTitle')}
										>
											{autoSortBusy ? (
												<ArrowPathIcon
													className="h-4 w-4 shrink-0 animate-spin"
													aria-hidden
												/>
											) : (
												<FolderOpenIcon
													className="h-4 w-4 shrink-0"
													aria-hidden
												/>
											)}
											<span className="text-left">
												{t('files.autoSort.contentFolder')}
											</span>
										</DesktopAppButton>
									</div>
								</div>
							) : null}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};
