/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assembles Content Manager Files-tab chrome, advanced search, and
 * ContentManagerFilesTab props without owning list/mutation orchestration.
 *
 * Invariants:
 * - Every ContentManagerFilesTab prop remains wired; chrome slots are built here.
 * - Advanced-search UI stays on the Files tab only.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - ContentManagerFilesTab.tsx
 * - ContentManagerProMainSurface.tsx
 */

import type { TFunction } from 'i18next';
import type { ContentSearchResult } from '../../../services/contentApi';
import type { DesktopWindowStyle } from '../../../types/profile';
import type { ContentManagerTab } from '../contentManagerTypes';
import {
	ContentManagerFilesTab,
	type ContentManagerFilesTabProps,
} from '../ContentManagerFilesTab';
import { ContentManagerAdvancedSearch } from './ContentManagerAdvancedSearch';
import type { AdvancedVisibilityFilter } from './ContentManagerAdvancedSearch';
import { ContentManagerFilesLeftRailSection } from './ContentManagerFilesLeftRailSection';
import { ContentManagerHeaderActions } from './ContentManagerHeaderActions';
import { ContentManagerTabStrip } from './ContentManagerTabStrip';

export type ContentManagerProFilesTabBridgeProps = {
	t: TFunction<'contentManager'>;
	showEmbeddedFilesSplit: boolean;
	activeTab: ContentManagerTab;
	setActiveTab: React.Dispatch<React.SetStateAction<ContentManagerTab>>;
	embeddedTabIconClass: string;
	shellFrame: DesktopWindowStyle;
	handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
	uploadProgress: number;
	uploadBatch: { current: number; total: number } | null;
	setOwnedArchiveModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	advancedQuery: string;
	setAdvancedQuery: React.Dispatch<React.SetStateAction<string>>;
	advancedContentType: string;
	setAdvancedContentType: React.Dispatch<React.SetStateAction<string>>;
	advancedVisibility: AdvancedVisibilityFilter;
	setAdvancedVisibility: React.Dispatch<
		React.SetStateAction<AdvancedVisibilityFilter>
	>;
	advancedTags: string;
	setAdvancedTags: React.Dispatch<React.SetStateAction<string>>;
	advancedDateFrom: string;
	setAdvancedDateFrom: React.Dispatch<React.SetStateAction<string>>;
	advancedDateTo: string;
	setAdvancedDateTo: React.Dispatch<React.SetStateAction<string>>;
	advancedSizeMin: string;
	setAdvancedSizeMin: React.Dispatch<React.SetStateAction<string>>;
	advancedSizeMax: string;
	setAdvancedSizeMax: React.Dispatch<React.SetStateAction<string>>;
	contentTypeOptions: Array<{ value: string; label: string }>;
	clearAdvancedSearch: () => void;
	runAdvancedSearchPage: (page: number) => void | Promise<void>;
	advancedLoading: boolean;
	hasAdvancedResults: boolean;
	advancedError: string | null;
	advancedResults: ContentSearchResult[];
	advancedTotal: number;
	advancedPage: number;
	advancedTotalPages: number;
	setAdvancedResults: React.Dispatch<
		React.SetStateAction<ContentSearchResult[]>
	>;
	setAdvancedTotal: React.Dispatch<React.SetStateAction<number>>;
	setAdvancedError: React.Dispatch<React.SetStateAction<string | null>>;
	setAdvancedPage: React.Dispatch<React.SetStateAction<number>>;
	openContentById: (id: string) => void | Promise<void>;
	resolveContentTypeLabel: (contentType: string) => string;
	createFolderUnderParent: (parentItemId: string) => void | Promise<void>;
	setBulkMoveOpen: React.Dispatch<React.SetStateAction<boolean>>;
	filesTab: Omit<
		ContentManagerFilesTabProps,
		| 'filesLeadingChrome'
		| 'filesPanelTabsSlot'
		| 'filesLibraryChrome'
		| 'advancedSearchSlot'
		| 'onDownloadOwnedArchive'
		| 'onCreateFolderInCurrent'
		| 'batchMove'
	>;
};

export function ContentManagerProFilesTabBridge({
	t,
	showEmbeddedFilesSplit,
	activeTab,
	setActiveTab,
	embeddedTabIconClass,
	shellFrame,
	handleFileSelect,
	uploadProgress,
	uploadBatch,
	setOwnedArchiveModalOpen,
	advancedQuery,
	setAdvancedQuery,
	advancedContentType,
	setAdvancedContentType,
	advancedVisibility,
	setAdvancedVisibility,
	advancedTags,
	setAdvancedTags,
	advancedDateFrom,
	setAdvancedDateFrom,
	advancedDateTo,
	setAdvancedDateTo,
	advancedSizeMin,
	setAdvancedSizeMin,
	advancedSizeMax,
	setAdvancedSizeMax,
	contentTypeOptions,
	clearAdvancedSearch,
	runAdvancedSearchPage,
	advancedLoading,
	hasAdvancedResults,
	advancedError,
	advancedResults,
	advancedTotal,
	advancedPage,
	advancedTotalPages,
	setAdvancedResults,
	setAdvancedTotal,
	setAdvancedError,
	setAdvancedPage,
	openContentById,
	resolveContentTypeLabel,
	createFolderUnderParent,
	setBulkMoveOpen,
	filesTab,
}: ContentManagerProFilesTabBridgeProps): React.ReactElement {
	const {
		embedded,
		fetchContent,
		loading,
		fileInputRef,
		uploading,
		downloadingOwnedArchive,
		statsLoading,
		ownedFilesCount,
		showAdvancedSearch,
		downloadFile,
		explorerFolderTarget,
	} = filesTab;

	const filesLeadingChrome = showEmbeddedFilesSplit ? (
		<h1 id="content-manager-pro-title" className="sr-only">
			{t('files.appTitle')}
		</h1>
	) : undefined;

	const filesPanelTabsSlot = (
		<ContentManagerTabStrip
			activeTab={activeTab}
			setActiveTab={setActiveTab}
			embedded={embedded}
			embeddedTabIconClass={embeddedTabIconClass}
			shellFrame={shellFrame}
			railIconRow
		/>
	);

	const filesLibraryChrome = showEmbeddedFilesSplit ? (
		<ContentManagerFilesLeftRailSection>
			<ContentManagerHeaderActions
				embedded={embedded}
				railLayout
				shellFrame={shellFrame}
				fetchContent={fetchContent}
				loading={loading}
				fileInputRef={fileInputRef}
				onFileUploadChange={handleFileSelect}
				uploading={uploading ?? false}
				uploadProgress={uploadProgress ?? 0}
				uploadBatch={uploadBatch}
				onDownloadOwnedArchive={() => setOwnedArchiveModalOpen(true)}
				downloadingOwnedArchive={downloadingOwnedArchive ?? false}
				statsLoading={statsLoading ?? false}
				ownedFilesCount={ownedFilesCount ?? 0}
			/>
		</ContentManagerFilesLeftRailSection>
	) : undefined;

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			<ContentManagerFilesTab
				{...filesTab}
				filesLeadingChrome={filesLeadingChrome}
				filesPanelTabsSlot={filesPanelTabsSlot}
				filesLibraryChrome={filesLibraryChrome}
				onDownloadOwnedArchive={() => setOwnedArchiveModalOpen(true)}
				onCreateFolderInCurrent={
					explorerFolderTarget === 'unfiled'
						? undefined
						: () => void createFolderUnderParent(explorerFolderTarget)
				}
				batchMove={() => setBulkMoveOpen(true)}
				advancedSearchSlot={
					<ContentManagerAdvancedSearch
						showPanel={showAdvancedSearch}
						advancedQuery={advancedQuery}
						setAdvancedQuery={setAdvancedQuery}
						advancedContentType={advancedContentType}
						setAdvancedContentType={setAdvancedContentType}
						advancedVisibility={advancedVisibility}
						setAdvancedVisibility={setAdvancedVisibility}
						advancedTags={advancedTags}
						setAdvancedTags={setAdvancedTags}
						advancedDateFrom={advancedDateFrom}
						setAdvancedDateFrom={setAdvancedDateFrom}
						advancedDateTo={advancedDateTo}
						setAdvancedDateTo={setAdvancedDateTo}
						advancedSizeMin={advancedSizeMin}
						setAdvancedSizeMin={setAdvancedSizeMin}
						advancedSizeMax={advancedSizeMax}
						setAdvancedSizeMax={setAdvancedSizeMax}
						contentTypeOptions={contentTypeOptions}
						clearAdvancedSearch={clearAdvancedSearch}
						runAdvancedSearchPage={runAdvancedSearchPage}
						advancedLoading={advancedLoading}
						showResultsPanel={hasAdvancedResults}
						advancedError={advancedError}
						advancedResults={advancedResults}
						advancedTotal={advancedTotal}
						advancedPage={advancedPage}
						advancedTotalPages={advancedTotalPages}
						onHideResults={() => {
							setAdvancedResults([]);
							setAdvancedTotal(0);
							setAdvancedError(null);
							setAdvancedPage(1);
						}}
						openContentById={openContentById}
						downloadFile={downloadFile}
						resolveTypeLabel={resolveContentTypeLabel}
					/>
				}
			/>
		</div>
	);
}
