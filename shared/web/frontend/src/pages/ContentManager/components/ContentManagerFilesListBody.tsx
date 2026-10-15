/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scrollable files list body: loading skeleton, error/empty states, grouped grid/list.
 * Dense groups use real VirtualGrid / VirtualList (not CSS-only content-visibility).
 *
 * Invariants:
 * - Grid column count attribute mirrors keyboard navigation column step.
 * - Virtualization thresholds live in `contentManagerVirtualization.ts`.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `ContentManagerExplorerNestedFoldersPanel.tsx`
 * - `ContentManagerFilesGridVirtualBlock.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ArrowUturnLeftIcon,
	FolderIcon,
	FolderOpenIcon,
} from '@heroicons/react/24/outline';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { VirtualList } from '../../../components/shared/VirtualList';
import { cn } from '../../../utils/cn';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSectionLabel,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { DesktopItemResponse } from '../../Desktop/services/desktopApi';
import type {
	ContentManagerFilePanelGroup,
	ExplorerFolderTarget,
	FilesBrowseMode,
	GroupBy,
	ViewMode,
} from '../contentManagerTypes';
import { ALL_FILES_FOLDER_VISIBLE_STEP } from '../contentManagerTypes';
import { CONTENT_MANAGER_DESKTOP_GRID_CLASS } from '../utils/contentManagerFilesGridLayout';
import {
	CM_VIRTUAL_GRID_ROW_HEIGHT_PX,
	CM_VIRTUAL_LIST_ROW_HEIGHT_PX,
	computeVirtualGridColumnWidthPx,
	shouldVirtualizeContentManagerGrid,
	shouldVirtualizeContentManagerList,
} from '../utils/contentManagerVirtualization';
import { ContentManagerExplorerNestedFoldersPanel } from './ContentManagerExplorerNestedFoldersPanel';
import { ContentManagerFilesGridVirtualBlock } from './ContentManagerFilesGridVirtualBlock';

export type ContentManagerFilesListBodyProps = {
	scrollRef: React.RefObject<HTMLDivElement | null>;
	loading: boolean;
	viewMode: ViewMode;
	isMobile: boolean;
	shellContentPanelClass: string;
	contentListError: string | null;
	fetchContent: () => void | Promise<void>;
	filteredItems: ContentItem[];
	explorerNestedFolders: DesktopItemResponse[];
	embedded: boolean;
	filesEmptyStateCopy: { title: string; description: string };
	hasActiveListFilters: boolean;
	onResetListFilters: () => void;
	onCreateFolderInCurrent?: () => void;
	filesBrowseMode: FilesBrowseMode;
	explorerFolderTarget: ExplorerFolderTarget;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	filePanelGroups: ContentManagerFilePanelGroup[];
	groupBy: GroupBy;
	gridColumnCount: number;
	/** When set, dense grid virtualization is disabled (inline preview open). */
	inlinePreviewId?: string | null;
	onAllFilesShowMoreInFolder?: (groupId: string) => void;
	onOpenExplorerFolder: (itemId: string) => void;
	onFolderContextMenu: (
		event: React.MouseEvent,
		folder: DesktopItemResponse
	) => void;
	renderGridFileCard: (item: ContentItem, flatIdx: number) => React.ReactNode;
	renderListFileRow: (item: ContentItem, flatIdx: number) => React.ReactNode;
};

export function ContentManagerFilesListBody({
	scrollRef,
	loading,
	viewMode,
	isMobile,
	shellContentPanelClass,
	contentListError,
	fetchContent,
	filteredItems,
	explorerNestedFolders,
	embedded,
	filesEmptyStateCopy,
	hasActiveListFilters,
	onResetListFilters,
	onCreateFolderInCurrent,
	filesBrowseMode,
	explorerFolderTarget,
	fileInputRef,
	filePanelGroups,
	groupBy,
	gridColumnCount,
	inlinePreviewId = null,
	onAllFilesShowMoreInFolder,
	onOpenExplorerFolder,
	onFolderContextMenu,
	renderGridFileCard,
	renderListFileRow,
}: ContentManagerFilesListBodyProps): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const [panelSize, setPanelSize] = React.useState({ width: 0, height: 0 });

	React.useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const measure = () => {
			setPanelSize({ width: el.clientWidth, height: el.clientHeight });
		};
		measure();
		const ro = new ResizeObserver(() => measure());
		ro.observe(el);
		return () => ro.disconnect();
	}, [scrollRef]);

	return (
		<div
			ref={scrollRef}
			className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-gutter-stable"
		>
			{loading ? (
				<div
					role="status"
					className="py-4"
					aria-busy="true"
					aria-label={t('files.list.loadingAria')}
					aria-live="polite"
				>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'mb-3 flex items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5'
						)}
					>
						<ArrowPathIcon
							className="h-4 w-4 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
							aria-hidden
						/>
						<span>{t('files.list.loadingAria')}</span>
					</div>
					{viewMode === 'list' ? (
						<div
							className={cn(shellContentPanelClass, 'min-h-0 space-y-2 p-2')}
						>
							{(
								[
									'listrow-sk-0',
									'listrow-sk-1',
									'listrow-sk-2',
									'listrow-sk-3',
									'listrow-sk-4',
									'listrow-sk-5',
									'listrow-sk-6',
									'listrow-sk-7',
								] as const
							).map((kid) => (
								<DesktopAppSkeleton key={kid} className="h-14 rounded-xl" />
							))}
						</div>
					) : (
						<div
							className={cn(
								'grid gap-3',
								isMobile
									? 'grid-cols-1 sm:grid-cols-2'
									: CONTENT_MANAGER_DESKTOP_GRID_CLASS
							)}
						>
							{(
								[
									'list-sk-0',
									'list-sk-1',
									'list-sk-2',
									'list-sk-3',
									'list-sk-4',
									'list-sk-5',
									'list-sk-6',
									'list-sk-7',
								] as const
							).map((kid) => (
								<DesktopAppSkeleton key={kid} className="h-36 rounded-2xl" />
							))}
						</div>
					)}
				</div>
			) : contentListError ? (
				<section
					className="min-h-[min(40vh,14rem)]"
					aria-label={t('pro.notify.listFailed')}
				>
					<div
						className={cn(
							shellContentPanelClass,
							'min-h-0 overflow-hidden p-0'
						)}
					>
						<DesktopAppErrorState
							message={contentListError}
							actionLabel={t('pro.media.retry')}
							onAction={() => void fetchContent()}
						/>
					</div>
				</section>
			) : filteredItems.length === 0 && explorerNestedFolders.length === 0 ? (
				<div
					className={cn(
						shellContentPanelClass,
						'min-h-0',
						embedded ? 'p-5' : 'p-6'
					)}
					role="status"
					aria-live="polite"
				>
					<DesktopAppEmptyState
						className="gap-5 py-10"
						icon={
							<FolderOpenIcon className="h-10 w-10 text-(--desktop-text-secondary)" />
						}
						title={filesEmptyStateCopy.title}
						description={filesEmptyStateCopy.description}
					>
						{hasActiveListFilters ? (
							<DesktopAppButton
								type="button"
								onClick={onResetListFilters}
								variant="neutral"
							>
								<ArrowUturnLeftIcon className="w-4 h-4" />
								{t('files.list.resetFilters')}
							</DesktopAppButton>
						) : onCreateFolderInCurrent &&
							filesBrowseMode === 'explorer' &&
							explorerFolderTarget !== 'unfiled' ? (
							<div className="flex flex-wrap justify-center gap-2">
								<DesktopAppButton
									type="button"
									onClick={onCreateFolderInCurrent}
									variant="neutral"
								>
									<FolderIcon className="h-4 w-4" />
									{t('explorer.folderMenu.newFolder')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									onClick={() => fileInputRef.current?.click()}
									variant="accent"
								>
									<ArrowUpTrayIcon className="w-4 h-4" />
									{t('files.toolbar.upload')}
								</DesktopAppButton>
							</div>
						) : (
							<DesktopAppButton
								type="button"
								onClick={() => fileInputRef.current?.click()}
								variant="accent"
							>
								<ArrowUpTrayIcon className="w-4 h-4" />
								{t('files.toolbar.upload')}
							</DesktopAppButton>
						)}
					</DesktopAppEmptyState>
				</div>
			) : (
				<div className="space-y-6">
					<ContentManagerExplorerNestedFoldersPanel
						folders={explorerNestedFolders}
						viewMode={viewMode}
						shellContentPanelClass={shellContentPanelClass}
						onOpenFolder={onOpenExplorerFolder}
						onFolderContextMenu={onFolderContextMenu}
					/>
					<ContentManagerFilesGroupedList
						filePanelGroups={filePanelGroups}
						viewMode={viewMode}
						isMobile={isMobile}
						shellContentPanelClass={shellContentPanelClass}
						filesBrowseMode={filesBrowseMode}
						groupBy={groupBy}
						gridColumnCount={gridColumnCount}
						panelWidth={panelSize.width}
						panelHeight={panelSize.height}
						hasInlinePreview={Boolean(inlinePreviewId)}
						onAllFilesShowMoreInFolder={onAllFilesShowMoreInFolder}
						renderGridFileCard={renderGridFileCard}
						renderListFileRow={renderListFileRow}
					/>
				</div>
			)}
		</div>
	);
}

type ContentManagerFilesGroupedListProps = Pick<
	ContentManagerFilesListBodyProps,
	| 'filePanelGroups'
	| 'viewMode'
	| 'isMobile'
	| 'shellContentPanelClass'
	| 'filesBrowseMode'
	| 'groupBy'
	| 'gridColumnCount'
	| 'onAllFilesShowMoreInFolder'
	| 'renderGridFileCard'
	| 'renderListFileRow'
> & {
	panelWidth: number;
	panelHeight: number;
	hasInlinePreview: boolean;
};

function ContentManagerFilesGroupedList({
	filePanelGroups,
	viewMode,
	isMobile,
	shellContentPanelClass,
	filesBrowseMode,
	groupBy,
	gridColumnCount,
	panelWidth,
	panelHeight,
	hasInlinePreview,
	onAllFilesShowMoreInFolder,
	renderGridFileCard,
	renderListFileRow,
}: ContentManagerFilesGroupedListProps): React.ReactElement {
	const { t } = useTranslation('contentManager');
	let groupFlatOffset = 0;
	const virtualViewportHeight = Math.max(280, panelHeight || 400);
	const columnWidth = computeVirtualGridColumnWidthPx(
		panelWidth || gridColumnCount * 176,
		gridColumnCount
	);

	return (
		<>
			{filePanelGroups.map((group) => {
				const groupKey = group.groupId;
				const groupStart = groupFlatOffset;
				groupFlatOffset += group.items.length;
				const showFolderMore =
					filesBrowseMode === 'all_files' &&
					groupBy === 'folder' &&
					group.items.length < group.totalInFolder &&
					onAllFilesShowMoreInFolder;
				const useVirtualGrid = shouldVirtualizeContentManagerGrid({
					itemCount: group.items.length,
					isMobile,
					hasInlinePreview,
				});
				const useVirtualList = shouldVirtualizeContentManagerList(
					group.items.length
				);

				return (
					<div key={groupKey}>
						{group.title ? (
							<h3 className="mb-3 flex items-center gap-2">
								<span className="h-2 w-2 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.65)]" />
								<DesktopAppSectionLabel>{group.title}</DesktopAppSectionLabel>
								<DesktopAppStatusBadge className="tabular-nums">
									({group.totalInFolder})
								</DesktopAppStatusBadge>
							</h3>
						) : null}
						{viewMode === 'grid' ? (
							useVirtualGrid ? (
								<div data-cm-grid-cols={gridColumnCount} data-cm-virtual-grid>
									<ContentManagerFilesGridVirtualBlock
										items={group.items}
										columnCount={gridColumnCount}
										columnWidth={columnWidth}
										height={virtualViewportHeight}
										groupStart={groupStart}
										renderGridFileCard={renderGridFileCard}
									/>
								</div>
							) : (
								<div
									data-cm-grid-cols={gridColumnCount}
									className={cn(
										'grid gap-3',
										isMobile
											? 'grid-cols-1 sm:grid-cols-2'
											: CONTENT_MANAGER_DESKTOP_GRID_CLASS
									)}
								>
									{group.items.map((item, iInGroup) => {
										const flatIdx = groupStart + iInGroup;
										return (
											<div
												key={item.id}
												className="min-h-0 [content-visibility:auto]"
												style={{
													containIntrinsicSize: `auto ${CM_VIRTUAL_GRID_ROW_HEIGHT_PX}px`,
												}}
											>
												{renderGridFileCard(item, flatIdx)}
											</div>
										);
									})}
								</div>
							)
						) : useVirtualList ? (
							<div
								className={cn(shellContentPanelClass, 'min-h-0 p-2')}
								data-cm-virtual-list
							>
								<VirtualList
									items={group.items}
									itemHeight={CM_VIRTUAL_LIST_ROW_HEIGHT_PX}
									height={virtualViewportHeight}
									className="min-h-0"
									getItemKey={(index) => group.items[index]?.id ?? index}
									renderItem={(item, iInGroup) =>
										renderListFileRow(item, groupStart + iInGroup)
									}
								/>
							</div>
						) : (
							<div className={cn(shellContentPanelClass, 'min-h-0 p-2')}>
								<div className="space-y-1">
									{group.items.map((item, iInGroup) => {
										const flatIdx = groupStart + iInGroup;
										return renderListFileRow(item, flatIdx);
									})}
								</div>
							</div>
						)}
						{showFolderMore ? (
							<div className="mt-3 flex justify-center">
								<DesktopAppButton
									type="button"
									variant="neutral"
									className="text-xs"
									onClick={() => onAllFilesShowMoreInFolder?.(groupKey)}
								>
									{t('files.allFiles.showMoreInFolder', {
										count: ALL_FILES_FOLDER_VISIBLE_STEP,
									})}
								</DesktopAppButton>
							</div>
						) : null}
					</div>
				);
			})}
		</>
	);
}
