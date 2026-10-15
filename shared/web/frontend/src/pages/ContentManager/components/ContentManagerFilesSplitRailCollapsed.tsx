/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsed split-rail toolbar: refresh/upload/archive + explorer monogram folders.
 *
 * Invariants:
 * - Explorer monograms render only in explorer browse mode.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `ContentManagerRailCollapsedToolbar.tsx`
 */
import * as React from 'react';
import { ContentManagerRailCollapsedToolbar } from './ContentManagerRailCollapsedToolbar';
import { ContentManagerFilesExplorerCollapsedRail } from './ContentManagerFilesExplorerTree';
import type { ContentManagerFilesExplorerCollapsedRailProps } from './ContentManagerFilesExplorerTree';

export type ContentManagerFilesSplitRailCollapsedProps = {
	fetchContent: () => void | Promise<void>;
	loading: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	uploading: boolean;
	onDownloadOwnedArchive: () => void;
	downloadingOwnedArchive: boolean;
	statsLoading: boolean;
	ownedFilesCount: number;
	showAdvancedSearch: boolean;
	onToggleAdvancedSearch: () => void;
	onExpandRail: () => void;
	explorerRailProps: ContentManagerFilesExplorerCollapsedRailProps;
};

export function ContentManagerFilesSplitRailCollapsed({
	fetchContent,
	loading,
	fileInputRef,
	uploading,
	onDownloadOwnedArchive,
	downloadingOwnedArchive,
	statsLoading,
	ownedFilesCount,
	showAdvancedSearch,
	onToggleAdvancedSearch,
	onExpandRail,
	explorerRailProps,
}: ContentManagerFilesSplitRailCollapsedProps): React.ReactElement {
	const showExplorerMonograms =
		explorerRailProps.filesBrowseMode === 'explorer';

	return (
		<>
			<ContentManagerRailCollapsedToolbar
				fetchContent={fetchContent}
				loading={loading}
				fileInputRef={fileInputRef}
				uploading={uploading}
				onDownloadOwnedArchive={onDownloadOwnedArchive}
				downloadingOwnedArchive={downloadingOwnedArchive}
				statsLoading={statsLoading}
				ownedFilesCount={ownedFilesCount}
				showAdvancedSearch={showAdvancedSearch}
				onToggleAdvancedSearch={onToggleAdvancedSearch}
				onExpandRail={onExpandRail}
			/>
			{showExplorerMonograms ? (
				<div
					className="my-0.5 h-px w-7 shrink-0 bg-(--desktop-border-subtle)"
					aria-hidden
				/>
			) : null}
			<ContentManagerFilesExplorerCollapsedRail {...explorerRailProps} />
		</>
	);
}
