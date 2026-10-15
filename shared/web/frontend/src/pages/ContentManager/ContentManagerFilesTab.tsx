/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Files tab UI for Content Manager: layout orchestration for rail, panel chrome, list, and pagination.
 * Advanced search UI is injected via `advancedSearchSlot`; owning state stays in `ContentManagerPro`.
 *
 * Invariants:
 * - Split desktop layout keeps list scrolling inside the right panel.
 * - Bulk actions operate only on currently selected visible file ids.
 *
 * Related:
 * - `ContentManagerPro.tsx`
 * - `contentManagerFilesTabTypes.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { DesktopExplorerCollapsibleRail } from '../Desktop/components/DesktopExplorerCollapsibleRail';
import { useDesktopFolderExplorerRailCollapsed } from '../Desktop/hooks/useDesktopFolderExplorerRailCollapsed';
import {
	ContentManagerFilesSplitSearchChrome,
	ContentManagerFilesStackSearchChrome,
} from './components/ContentManagerFilesChrome';
import {
	ContentManagerFilesExplorerCollapsedRail,
	ContentManagerFilesExplorerTree,
} from './components/ContentManagerFilesExplorerTree';
import { ContentManagerFilesLeftRailSection } from './components/ContentManagerFilesLeftRailSection';
import { ContentManagerFilesListBody } from './components/ContentManagerFilesListBody';
import { ContentManagerFilesPanelTopChrome } from './components/ContentManagerFilesPanelTopChrome';
import { ContentManagerFilesPagination } from './components/ContentManagerFilesPagination';
import { ContentManagerAllFilesLoadMore } from './components/ContentManagerAllFilesLoadMore';
import { ContentManagerFilesSelectionBar } from './components/ContentManagerFilesSelectionBar';
import { ContentManagerFilesSplitRailCollapsed } from './components/ContentManagerFilesSplitRailCollapsed';
import { ContentManagerFilesWayfinding } from './components/ContentManagerFilesWayfinding';
import type { ContentManagerFilesTabProps } from './contentManagerFilesTabTypes';
import { useContentManagerFilesGridMeasure } from './hooks/useContentManagerFilesGridMeasure';
import { useContentManagerFilesListRenderers } from './hooks/useContentManagerFilesListRenderers';
import { useContentManagerFilesResetFilters } from './hooks/useContentManagerFilesResetFilters';
import { partitionSelectedByEligibility } from './utils/contentManagerBulkEligibility';
import { resolveContentManagerSelectionCopy } from './utils/contentManagerListUx';

export type { ContentManagerFilesTabProps } from './contentManagerFilesTabTypes';

export const ContentManagerFilesTab: React.FC<ContentManagerFilesTabProps> = (
	props
) => {
	const { t } = useTranslation('contentManager');
	const {
		embedded,
		embeddedMobileLayout,
		filesLeadingChrome,
		filesPanelTabsSlot,
		filesLibraryChrome,
		uploading = false,
		downloadingOwnedArchive = false,
		statsLoading = false,
		ownedFilesCount = 0,
		onDownloadOwnedArchive,
		shellContentPanelClass,
		cabinetLocked,
		cabinetProjectLabel,
		explorerContextPlaceLabel,
		filesBrowseMode,
		setFilesBrowseMode,
		folderTreeRoots,
		explorerNestedFolders,
		onOpenExplorerFolder,
		onFolderContextMenu,
		onRequestFolderMenu,
		onCreateFolderInCurrent,
		searchQuery,
		setSearchQuery,
		searchMode,
		setSearchMode,
		searchInputRef,
		sortField,
		sortOrder,
		setSortField,
		setSortOrder,
		setCurrentPage,
		showFilters,
		setShowFilters,
		showAdvancedSearch,
		setShowAdvancedSearch,
		autoSortBusy,
		loading,
		runAutoSortToSystemFolders,
		viewMode,
		setViewMode,
		selectMode,
		setSelectMode,
		selectedIds,
		setSelectedIds,
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
		setFilterTag,
		groupBy,
		setGroupBy,
		advancedSearchSlot,
		selectAll,
		batchDownload,
		batchDownloadLoading,
		batchCopy,
		batchCopyLoading,
		batchMove,
		batchDelete,
		setAssignCompanyId,
		setAssignProjectId,
		refreshProjects,
		setAssignTenancyOpen,
		explorerFolderTarget,
		setExplorerFolderTarget,
		explorerExpandedFolderIds,
		setExplorerExpandedFolderIds,
		explorerDropHighlight,
		setExplorerDropHighlight,
		onExplorerDropToFolder,
		contentListError,
		fetchContent,
		filteredItems,
		filePanelGroups,
		filesEmptyStateCopy,
		hasActiveListFilters,
		fileInputRef,
		isMobile,
		viewGridFile,
		downloadFile,
		reprocessContentDisplay,
		deleteFile,
		openEdit,
		inlinePreviewId,
		inlinePreviewUrl,
		handleToggleInlinePreview,
		resolveDragContentIds,
		resolveContentDragPayload,
		gridFocusIndex,
		handleGridArrowNavigate,
		toggleSelection,
		copyContentLink,
		copyFile,
		onMoveFile,
		onAllFilesShowMoreInFolder,
		totalItems,
		currentPage,
		allFilesHasMore,
		allFilesLoadingMore,
		allFilesLoadedCount,
		allFilesLoadMore,
		gridColumnCount,
		setGridColumnCount,
	} = props;

	const splitFilesLayout = Boolean(filesLeadingChrome);
	const forceColumnFilesSplit = Boolean(embeddedMobileLayout);
	const { collapsed: explorerRailCollapsed, toggle: toggleExplorerRail } =
		useDesktopFolderExplorerRailCollapsed();

	const explorerTreeProps = {
		folderTreeRoots,
		explorerFolderTarget,
		setExplorerFolderTarget,
		explorerExpandedFolderIds,
		setExplorerExpandedFolderIds,
		explorerDropHighlight,
		setExplorerDropHighlight,
		onExplorerDropToFolder,
		onRequestFolderMenu,
	};

	const explorerRailProps = {
		filesBrowseMode,
		folderTreeRoots,
		explorerFolderTarget,
		setExplorerFolderTarget,
		explorerDropHighlight,
		setExplorerDropHighlight,
		onExplorerDropToFolder,
	};

	const searchChromeProps = {
		searchQuery,
		setSearchQuery,
		searchInputRef,
		searchMode,
		setSearchMode,
		showAdvancedSearch,
		setShowAdvancedSearch,
		advancedSearchSlot,
	};

	const selectionCopy = React.useMemo(
		() => resolveContentManagerSelectionCopy(filesBrowseMode, groupBy),
		[filesBrowseMode, groupBy]
	);

	const bulkEligibility = React.useMemo(
		() => partitionSelectedByEligibility(filteredItems, selectedIds),
		[filteredItems, selectedIds]
	);

	const resetListFilters = useContentManagerFilesResetFilters({
		setSearchQuery,
		setFilterType,
		setFilterVisibility,
		setFilterFolderId,
		setExplorerFolderTarget,
		setFilterCompanyId,
		setFilterProjectId,
		setFilterTag,
		setCurrentPage,
	});

	const gridWidthMeasureRef = useContentManagerFilesGridMeasure({
		isMobile,
		setGridColumnCount,
	});

	const { renderGridFileCard, renderListFileRow } =
		useContentManagerFilesListRenderers({
			embedded,
			filterVisibility,
			selectedIds,
			selectMode,
			toggleSelection,
			viewGridFile,
			downloadFile,
			deleteFile,
			openEdit,
			reprocessContentDisplay,
			copyContentLink,
			copyFile,
			onMoveFile,
			inlinePreviewId,
			inlinePreviewUrl,
			handleToggleInlinePreview,
			filesBrowseMode,
			groupBy,
			resolveDragContentIds,
			resolveContentDragPayload,
			gridFocusIndex,
			handleGridArrowNavigate,
		});

	const splitRailCollapsedContent = splitFilesLayout ? (
		<ContentManagerFilesSplitRailCollapsed
			fetchContent={fetchContent}
			loading={loading}
			fileInputRef={fileInputRef}
			uploading={uploading}
			onDownloadOwnedArchive={onDownloadOwnedArchive ?? (() => {})}
			downloadingOwnedArchive={downloadingOwnedArchive}
			statsLoading={statsLoading}
			ownedFilesCount={ownedFilesCount}
			showAdvancedSearch={showAdvancedSearch}
			onToggleAdvancedSearch={() => setShowAdvancedSearch((prev) => !prev)}
			onExpandRail={() => {
				if (explorerRailCollapsed) toggleExplorerRail();
			}}
			explorerRailProps={explorerRailProps}
		/>
	) : null;

	const explorerCollapsedFolderRail = (
		<ContentManagerFilesExplorerCollapsedRail {...explorerRailProps} />
	);

	return (
		<section
			aria-label={t('tabs.files')}
			data-cm-files-split={splitFilesLayout ? '1' : undefined}
			className={cn(
				'flex min-h-0 min-w-0 flex-1',
				splitFilesLayout
					? forceColumnFilesSplit
						? 'min-h-0 flex-1 flex-col gap-2'
						: 'min-h-0 flex-col gap-3 md:min-h-0 md:flex-row md:items-stretch md:gap-0'
					: 'flex-col gap-4'
			)}
		>
			{splitFilesLayout ? (
				<DesktopExplorerCollapsibleRail
					collapsed={explorerRailCollapsed}
					onToggle={toggleExplorerRail}
					expandAriaLabel={t('files.leftRail.expandRail')}
					collapseAriaLabel={t('files.leftRail.collapseRail')}
					landmarkLabel={t('files.leftRail.library')}
					expandedClassName={
						forceColumnFilesSplit
							? 'max-h-[min(38dvh,16rem)] min-h-0 w-full shrink-0 border-b border-(--desktop-border-subtle) pb-2'
							: 'max-h-[min(52dvh,26rem)] min-h-0 w-full shrink-0 border-(--desktop-border-subtle) md:max-h-none md:w-[min(21rem,38vw)] md:max-w-92 md:border-e md:pe-3'
					}
					contentClassName="divide-y divide-(--desktop-border-subtle)/60"
					collapsedContent={splitRailCollapsedContent}
				>
					{filesLeadingChrome}
					{filesLibraryChrome}
					{cabinetLocked && cabinetProjectLabel ? (
						<ContentManagerFilesLeftRailSection
							title={t('files.leftRail.scope')}
						>
							<div
								className="shrink-0 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 px-3 py-2.5 text-xs leading-snug text-(--desktop-text-secondary)"
								role="status"
							>
								{t('cabinet.scopeBanner', { project: cabinetProjectLabel })}
							</div>
						</ContentManagerFilesLeftRailSection>
					) : null}
					<ContentManagerFilesSplitSearchChrome {...searchChromeProps} />
					{filesBrowseMode === 'explorer' ? (
						<ContentManagerFilesLeftRailSection>
							<section
								className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-2 md:min-h-48"
								aria-label={t('files.browseMode.explorer')}
							>
								<ContentManagerFilesExplorerTree {...explorerTreeProps} />
							</section>
						</ContentManagerFilesLeftRailSection>
					) : null}
				</DesktopExplorerCollapsibleRail>
			) : null}
			{!splitFilesLayout ? (
				<>
					{cabinetLocked && cabinetProjectLabel ? (
						<div
							className="shrink-0 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 px-3 py-2.5 text-xs leading-snug text-(--desktop-text-secondary)"
							role="status"
						>
							{t('cabinet.scopeBanner', { project: cabinetProjectLabel })}
						</div>
					) : null}
					<div className="shrink-0">
						<ContentManagerFilesWayfinding
							filesBrowseMode={filesBrowseMode}
							explorerContextPlaceLabel={explorerContextPlaceLabel}
						/>
					</div>
					<ContentManagerFilesStackSearchChrome {...searchChromeProps} />
				</>
			) : null}

			<div
				className={cn(
					'flex min-h-0 min-w-0 flex-1 flex-col',
					splitFilesLayout ? '' : 'contents'
				)}
			>
				<div
					className={cn(
						'flex min-h-0 min-w-0 w-full max-w-full flex-1 gap-3 overflow-x-hidden',
						filesBrowseMode === 'explorer' && 'items-stretch',
						splitFilesLayout && 'min-h-0 flex-1'
					)}
				>
					{filesBrowseMode === 'explorer' && !splitFilesLayout ? (
						<DesktopExplorerCollapsibleRail
							collapsed={explorerRailCollapsed}
							onToggle={toggleExplorerRail}
							expandAriaLabel={t('files.leftRail.expandRail')}
							collapseAriaLabel={t('files.leftRail.collapseRail')}
							landmarkLabel={t('files.browseMode.explorer')}
							expandedClassName={cn(
								'w-[min(13.5rem,40vw)] shrink-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2',
								'max-h-[min(70vh,32rem)] self-start lg:sticky lg:top-3 lg:max-h-[min(calc(100vh-9rem),40rem)]',
								embedded && 'max-w-44'
							)}
							collapsedContent={explorerCollapsedFolderRail}
						>
							<section aria-label={t('files.browseMode.explorer')}>
								<ContentManagerFilesExplorerTree {...explorerTreeProps} />
							</section>
						</DesktopExplorerCollapsibleRail>
					) : null}
					<section
						id="content-manager-files-panel"
						data-cm-guide="files-panel"
						aria-labelledby={
							filesBrowseMode === 'explorer'
								? 'content-manager-browse-explorer'
								: filesBrowseMode === 'all_files'
									? 'content-manager-browse-all-files'
									: 'content-manager-browse-catalog'
						}
						className={cn(
							'flex min-h-0 min-w-0 flex-1 flex-col gap-2',
							splitFilesLayout && 'min-h-0'
						)}
					>
						<ContentManagerFilesPanelTopChrome
							panelTabsSlot={filesPanelTabsSlot}
							shellContentPanelClass={shellContentPanelClass}
							filesBrowseMode={filesBrowseMode}
							setFilesBrowseMode={setFilesBrowseMode}
							cabinetLocked={cabinetLocked}
							autoSortBusy={autoSortBusy}
							runAutoSortToSystemFolders={runAutoSortToSystemFolders}
							filterFolderId={filterFolderId}
							setFilterFolderId={setFilterFolderId}
							folders={folders}
							filterCompanyId={filterCompanyId}
							setFilterCompanyId={setFilterCompanyId}
							companies={companies}
							loadingCompanies={loadingCompanies}
							filterProjectId={filterProjectId}
							setFilterProjectId={setFilterProjectId}
							projects={projects}
							loadingProjects={loadingProjects}
							filterType={filterType}
							setFilterType={setFilterType}
							filterVisibility={filterVisibility}
							setFilterVisibility={setFilterVisibility}
							groupBy={groupBy}
							setGroupBy={setGroupBy}
							sortField={sortField}
							sortOrder={sortOrder}
							setSortField={setSortField}
							setSortOrder={setSortOrder}
							setCurrentPage={setCurrentPage}
							showFilters={showFilters}
							setShowFilters={setShowFilters}
							hasActiveListFilters={hasActiveListFilters}
							onResetListFilters={resetListFilters}
							viewMode={viewMode}
							setViewMode={setViewMode}
							selectMode={selectMode}
							setSelectMode={setSelectMode}
							selectedIds={selectedIds}
							setSelectedIds={setSelectedIds}
							filteredItems={filteredItems}
							selectAll={selectAll}
							loading={loading}
						/>
						{splitFilesLayout ? (
							<ContentManagerFilesWayfinding
								filesBrowseMode={filesBrowseMode}
								explorerContextPlaceLabel={explorerContextPlaceLabel}
								railMode
							/>
						) : null}
						<ContentManagerFilesSelectionBar
							selectMode={selectMode}
							loading={loading}
							filteredItems={filteredItems}
							selectedIds={selectedIds}
							selectionCopy={selectionCopy}
							bulkEligibility={bulkEligibility}
							selectAll={selectAll}
							batchDownload={batchDownload}
							batchDownloadLoading={batchDownloadLoading}
							batchCopy={batchCopy}
							batchCopyLoading={batchCopyLoading}
							batchMove={batchMove}
							batchDelete={batchDelete}
							filterCompanyId={filterCompanyId}
							filterProjectId={filterProjectId}
							setAssignCompanyId={setAssignCompanyId}
							setAssignProjectId={setAssignProjectId}
							refreshProjects={refreshProjects}
							setAssignTenancyOpen={setAssignTenancyOpen}
						/>
						<ContentManagerFilesListBody
							scrollRef={gridWidthMeasureRef}
							loading={loading}
							viewMode={viewMode}
							isMobile={isMobile}
							shellContentPanelClass={shellContentPanelClass}
							contentListError={contentListError}
							fetchContent={fetchContent}
							filteredItems={filteredItems}
							explorerNestedFolders={explorerNestedFolders}
							embedded={embedded}
							filesEmptyStateCopy={filesEmptyStateCopy}
							hasActiveListFilters={hasActiveListFilters}
							onResetListFilters={resetListFilters}
							onCreateFolderInCurrent={onCreateFolderInCurrent}
							filesBrowseMode={filesBrowseMode}
							explorerFolderTarget={explorerFolderTarget}
							fileInputRef={fileInputRef}
							filePanelGroups={filePanelGroups}
							groupBy={groupBy}
							gridColumnCount={gridColumnCount}
							inlinePreviewId={inlinePreviewId}
							onAllFilesShowMoreInFolder={onAllFilesShowMoreInFolder}
							onOpenExplorerFolder={onOpenExplorerFolder}
							onFolderContextMenu={onFolderContextMenu}
							renderGridFileCard={renderGridFileCard}
							renderListFileRow={renderListFileRow}
						/>
						<ContentManagerFilesPagination
							loading={loading}
							totalItems={totalItems}
							currentPage={currentPage}
							filesBrowseMode={filesBrowseMode}
							setCurrentPage={setCurrentPage}
						/>
						{filesBrowseMode === 'all_files' ? (
							<ContentManagerAllFilesLoadMore
								loading={loading}
								loadingMore={allFilesLoadingMore ?? false}
								loadedCount={allFilesLoadedCount ?? filteredItems.length}
								totalItems={totalItems}
								hasMore={allFilesHasMore ?? false}
								onLoadMore={allFilesLoadMore ?? (() => {})}
							/>
						) : null}
					</section>
				</div>
			</div>
		</section>
	);
};
