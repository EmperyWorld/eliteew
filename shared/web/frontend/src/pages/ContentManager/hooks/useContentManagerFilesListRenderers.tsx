/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable grid/list render callbacks for Content Manager file cards and rows.
 *
 * Invariants:
 * - Folder accent border applies in all_files mode or folder grouping.
 *
 * Related:
 * - `ContentManagerFileCard.tsx`
 * - `ContentManagerFileRow.tsx`
 */
import * as React from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { FileCard } from '../components/ContentManagerFileCard';
import { FileRow } from '../components/ContentManagerFileRow';
import type {
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
} from '../contentManagerTypes';
import type { ContentDragPayload } from '../utils/contentManagerDrag';
import { getFolderAccentBorderClass } from '../utils/contentManagerFolderAccent';

export type UseContentManagerFilesListRenderersArgs = {
	embedded: boolean;
	filterVisibility: FilterVisibility;
	selectedIds: ReadonlySet<string>;
	selectMode: boolean;
	toggleSelection: (
		id: string,
		opts?: { shiftKey?: boolean; index?: number; fromCheckbox?: boolean }
	) => void;
	viewGridFile: (item: ContentItem) => void;
	downloadFile: (id: string, name: string) => void | Promise<void>;
	deleteFile: (id: string) => void | Promise<void>;
	openEdit: (item: ContentItem) => void;
	reprocessContentDisplay?: (id: string, name: string) => void | Promise<void>;
	copyContentLink: (id: string) => void | Promise<void>;
	copyFile: (item: ContentItem) => void;
	onMoveFile?: (id: string) => void;
	inlinePreviewId: string | null;
	inlinePreviewUrl: string | null;
	handleToggleInlinePreview: (id: string) => void;
	filesBrowseMode: FilesBrowseMode;
	groupBy: GroupBy;
	resolveDragContentIds: (itemId: string) => string[];
	resolveContentDragPayload?: (itemId: string) => ContentDragPayload;
	gridFocusIndex: number;
	handleGridArrowNavigate: (key: string, itemId: string) => void;
};

export function useContentManagerFilesListRenderers(
	args: UseContentManagerFilesListRenderersArgs
): {
	renderGridFileCard: (item: ContentItem, flatIdx: number) => React.ReactNode;
	renderListFileRow: (item: ContentItem, flatIdx: number) => React.ReactNode;
} {
	const {
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
	} = args;

	const folderAccentForItem = React.useCallback(
		(item: ContentItem) =>
			filesBrowseMode === 'all_files' || groupBy === 'folder'
				? getFolderAccentBorderClass(item.folder_item_id ?? null)
				: undefined,
		[filesBrowseMode, groupBy]
	);

	const renderGridFileCard = React.useCallback(
		(item: ContentItem, flatIdx: number) => (
			<FileCard
				embedded={embedded}
				item={item}
				filterVisibility={filterVisibility}
				selected={selectedIds.has(item.id)}
				selectMode={selectMode}
				selectionIndex={flatIdx}
				onToggleSelect={toggleSelection}
				onViewFile={viewGridFile}
				onDownloadFile={downloadFile}
				onDeleteFile={deleteFile}
				onEditFile={openEdit}
				onReprocessDisplay={reprocessContentDisplay}
				onCopyLink={copyContentLink}
				onCopyFile={copyFile}
				onMoveFile={onMoveFile}
				inlinePreviewBlobUrl={
					inlinePreviewId === item.id ? inlinePreviewUrl : null
				}
				inlinePreviewLoading={inlinePreviewId === item.id && !inlinePreviewUrl}
				onToggleInlinePreview={handleToggleInlinePreview}
				explorerFolderDnD={filesBrowseMode === 'explorer'}
				folderAccentBorderClass={folderAccentForItem(item)}
				resolveDragContentIds={resolveDragContentIds}
				resolveContentDragPayload={resolveContentDragPayload}
				rovingTabIndex={gridFocusIndex === flatIdx ? 0 : -1}
				onGridArrowNavigate={handleGridArrowNavigate}
			/>
		),
		[
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
			folderAccentForItem,
			resolveDragContentIds,
			resolveContentDragPayload,
			gridFocusIndex,
			handleGridArrowNavigate,
		]
	);

	const renderListFileRow = React.useCallback(
		(item: ContentItem, flatIdx: number) => (
			<FileRow
				key={item.id}
				item={item}
				selected={selectedIds.has(item.id)}
				selectMode={selectMode}
				selectionIndex={flatIdx}
				onToggleSelect={toggleSelection}
				onViewFile={viewGridFile}
				onDownloadFile={downloadFile}
				onDeleteFile={deleteFile}
				onEditFile={openEdit}
				onReprocessDisplay={reprocessContentDisplay}
				onCopyLink={copyContentLink}
				onCopyFile={copyFile}
				onMoveFile={onMoveFile}
				explorerFolderDnD={filesBrowseMode === 'explorer'}
				folderAccentBorderClass={folderAccentForItem(item)}
				resolveDragContentIds={resolveDragContentIds}
				resolveContentDragPayload={resolveContentDragPayload}
			/>
		),
		[
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
			filesBrowseMode,
			folderAccentForItem,
			resolveDragContentIds,
			resolveContentDragPayload,
		]
	);

	return { renderGridFileCard, renderListFileRow };
}
