/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the Content Manager Pro shell surface: drag overlay, header, status banners,
 * preview, folder menu, modals, and guide tour. Tab bodies live in TabPanels (F-01).
 *
 * Invariants:
 * - Parent retains orchestration state; this module is presentation-only.
 * - Files-tab prop assembly stays in ContentManagerProFilesTabBridge.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - ContentManagerProMainSurfaceTabPanels.tsx
 * - ContentManagerProFilesTabBridge.tsx
 * - ContentManagerProModals.tsx
 */

import { AnimatePresence, motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import type { Activity } from '../../../components/UnifiedContent/hooks/useActivityLog';
import type {
	Company,
	Content as ContentItem,
	ContentStats,
	Project,
	ShareResponse,
	Version,
} from '../../../components/UnifiedContent/types';
import type { ContentViewHistoryApiItem } from '../../../services/contentApi';
import { cn } from '@/utils/cn';
import { MOBILE_EMBEDDED_APP_ROOT_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import {
	DesktopAppButton,
	DesktopProductStatusBanner,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { getDesktopShellHeaderStripClassName } from '../../Desktop/utils/desktopVisualSystem';
import type { DesktopWindowStyle } from '../../../types/profile';
import type {
	ContentManagerTab,
	FilesBrowseMode,
} from '../contentManagerTypes';
import type { ContentManagerFolderMenuTarget } from './ContentManagerFolderContextMenu';
import {
	ContentManagerGuideModal,
	CONTENT_MANAGER_ROOT_ID,
} from './ContentManagerGuideModal';
import { ContentManagerFolderContextMenu } from './ContentManagerFolderContextMenu';
import { ContentManagerHeaderActions } from './ContentManagerHeaderActions';
import { ContentManagerPreviewModal } from './ContentManagerPreviewModal';
import type { ContentManagerProFilesTabBridgeProps } from './ContentManagerProFilesTabBridge';
import {
	ContentManagerProModals,
	type ContentManagerProModalsProps,
} from './ContentManagerProModals';
import { ContentManagerProMainSurfaceTabPanels } from './ContentManagerProMainSurfaceTabPanels';
import { ContentManagerTabStrip } from './ContentManagerTabStrip';
import { ContentManagerUploadQueuePanel } from './ContentManagerUploadQueuePanel';
import {
	ArrowUpTrayIcon,
	CheckIcon,
	FolderOpenIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type ContentManagerProMainSurfaceProps = {
	t: TFunction<'contentManager'>;
	embedded: boolean;
	embeddedMobileLayout: boolean;
	rootRef: React.RefObject<HTMLElement | null>;
	handleRootDragOver: (event: React.DragEvent) => void;
	handleRootDragLeave: (event: React.DragEvent) => void;
	handleRootDrop: (event: React.DragEvent) => void;
	isDragging: boolean;
	dragOverlayZ: number;
	filesBrowseMode: FilesBrowseMode;
	explorerFolderTarget: string;
	explorerSelectedFolderName: string | null;
	showEmbeddedFilesSplit: boolean;
	shellFrame: DesktopWindowStyle;
	activeTab: ContentManagerTab;
	setActiveTab: React.Dispatch<React.SetStateAction<ContentManagerTab>>;
	embeddedTabIconClass: string;
	stats: ContentStats | null;
	totalItems: number;
	formatSize: (bytes: number) => string;
	fetchContent: () => void | Promise<void>;
	loading: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
	uploading: boolean;
	uploadProgress: number;
	uploadBatch: { current: number; total: number } | null;
	setOwnedArchiveModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	downloadingOwnedArchive: boolean;
	statsLoading: boolean;
	ownedFilesCount: number;
	success: string | null;
	setSuccess: React.Dispatch<React.SetStateAction<string | null>>;
	error: string | null;
	setError: React.Dispatch<React.SetStateAction<string | null>>;
	uploadQueue: React.ComponentProps<
		typeof ContentManagerUploadQueuePanel
	>['queue'];
	retryUploadFile: React.ComponentProps<
		typeof ContentManagerUploadQueuePanel
	>['retryFile'];
	clearUploadQueue: () => void;
	shellContentPanelClass: string;
	statsTabKey: number;
	setStatsTabKey: React.Dispatch<React.SetStateAction<number>>;
	managerActivities: Activity[];
	managerActivityLoading: boolean;
	noopUndoActivity: () => Promise<boolean>;
	viewHistoryEntries: ContentViewHistoryApiItem[];
	viewHistoryLoading: boolean;
	clearViewHistoryDb: () => void | Promise<void>;
	setPreviewItem: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	registerView: (item: ContentItem) => void | Promise<void>;
	quotaBytesUsed: number | null;
	quotaBytesLimit: number | null;
	quotaLoading: boolean;
	quotaError: string | null;
	onQuotaRetry: () => void | Promise<void>;
	tagsTabKey: number;
	setTagsTabKey: React.Dispatch<React.SetStateAction<number>>;
	popularTags: Array<{ tag: string; count: number }>;
	onTagSelect: (tag: string) => void;
	versionsTabKey: number;
	setVersionsTabKey: React.Dispatch<React.SetStateAction<number>>;
	versions: Version[];
	selectedContent: ContentItem | null;
	versionsCompanies: Company[];
	versionsProjects: Project[];
	versionsLoading: boolean;
	selectedContentLoading: boolean;
	handleVersionDownload: (
		versionId: string,
		versionNumber: number,
		name: string
	) => void | Promise<void>;
	handleVersionRestore: (contentId: string, versionNumber: number) => void;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	setSelectedContentDetails: React.Dispatch<
		React.SetStateAction<ContentItem | null>
	>;
	setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
	multiVersionItems: ContentItem[];
	multiVersionLoading: boolean;
	selectContentForVersionsTab: (contentId: string) => void;
	sharedTabKey: number;
	setSharedTabKey: React.Dispatch<React.SetStateAction<number>>;
	sharedContents: ShareResponse[];
	sharedLoading: boolean;
	handleSharedContentsRefresh: () => void;
	downloadFile: (id: string, name: string) => void | Promise<void>;
	openContentById: (id: string) => void | Promise<void>;
	commentsTabKey: number;
	setCommentsTabKey: React.Dispatch<React.SetStateAction<number>>;
	selectedContentId: string | null;
	currentContentUserId: string;
	handleFileCommentsAfterUpdate: () => void;
	duplicatesTabKey: number;
	setDuplicatesTabKey: React.Dispatch<React.SetStateAction<number>>;
	handleDuplicateFinderChange: () => void;
	brokenFilesTabKey: number;
	setBrokenFilesTabKey: React.Dispatch<React.SetStateAction<number>>;
	handleBrokenFilesChange: () => void;
	previewItemResolved: ContentItem | null;
	previewViewport: { top: number; height: number } | null;
	closePreviewModal: () => void;
	resolveContentTypeLabel: (contentType: string) => string;
	requestDeleteFile: (id: string) => void;
	openPreviousPreview: () => void;
	openNextPreview: () => void;
	previewPreviousItem: ContentItem | null;
	previewNextItem: ContentItem | null;
	previewPositionLabel: string | null;
	folderMenuTarget: ContentManagerFolderMenuTarget | null;
	folderMenuPos: { x: number; y: number } | null;
	closeFolderMenu: () => void;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<'unfiled' | string>
	>;
	createFolderUnderParent: (parentItemId: string) => void | Promise<void>;
	renameExplorerFolder: (
		itemId: string,
		currentName: string
	) => void | Promise<void>;
	deleteExplorerFolder: (itemId: string, name: string) => void | Promise<void>;
	fetchFolders: () => void | Promise<void>;
	contentGuideOpen: boolean;
	setContentGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
	prepareContentGuideStep: (stepId: string) => void;
	filesBridge: ContentManagerProFilesTabBridgeProps;
	modals: ContentManagerProModalsProps;
};

export function ContentManagerProMainSurface({
	t,
	embedded,
	embeddedMobileLayout,
	rootRef,
	handleRootDragOver,
	handleRootDragLeave,
	handleRootDrop,
	isDragging,
	dragOverlayZ,
	filesBrowseMode,
	explorerFolderTarget,
	explorerSelectedFolderName,
	showEmbeddedFilesSplit,
	shellFrame,
	activeTab,
	setActiveTab,
	embeddedTabIconClass,
	stats,
	totalItems,
	formatSize,
	fetchContent,
	loading,
	fileInputRef,
	handleFileSelect,
	uploading,
	uploadProgress,
	uploadBatch,
	setOwnedArchiveModalOpen,
	downloadingOwnedArchive,
	statsLoading,
	ownedFilesCount,
	success,
	setSuccess,
	error,
	setError,
	uploadQueue,
	retryUploadFile,
	clearUploadQueue,
	shellContentPanelClass,
	statsTabKey,
	setStatsTabKey,
	managerActivities,
	managerActivityLoading,
	noopUndoActivity,
	viewHistoryEntries,
	viewHistoryLoading,
	clearViewHistoryDb,
	setPreviewItem,
	registerView,
	quotaBytesUsed,
	quotaBytesLimit,
	quotaLoading,
	quotaError,
	onQuotaRetry,
	tagsTabKey,
	setTagsTabKey,
	popularTags,
	onTagSelect,
	versionsTabKey,
	setVersionsTabKey,
	versions,
	selectedContent,
	versionsCompanies,
	versionsProjects,
	versionsLoading,
	selectedContentLoading,
	handleVersionDownload,
	handleVersionRestore,
	setSelectedIds,
	setSelectedContentDetails,
	setVersions,
	multiVersionItems,
	multiVersionLoading,
	selectContentForVersionsTab,
	sharedTabKey,
	setSharedTabKey,
	sharedContents,
	sharedLoading,
	handleSharedContentsRefresh,
	downloadFile,
	openContentById,
	commentsTabKey,
	setCommentsTabKey,
	selectedContentId,
	currentContentUserId,
	handleFileCommentsAfterUpdate,
	duplicatesTabKey,
	setDuplicatesTabKey,
	handleDuplicateFinderChange,
	brokenFilesTabKey,
	setBrokenFilesTabKey,
	handleBrokenFilesChange,
	previewItemResolved,
	previewViewport,
	closePreviewModal,
	resolveContentTypeLabel,
	requestDeleteFile,
	openPreviousPreview,
	openNextPreview,
	previewPreviousItem,
	previewNextItem,
	previewPositionLabel,
	folderMenuTarget,
	folderMenuPos,
	closeFolderMenu,
	setExplorerFolderTarget,
	createFolderUnderParent,
	renameExplorerFolder,
	deleteExplorerFolder,
	fetchFolders,
	contentGuideOpen,
	setContentGuideOpen,
	prepareContentGuideStep,
	filesBridge,
	modals,
}: ContentManagerProMainSurfaceProps): React.ReactElement {
	const RootShell: 'section' | 'div' = embedded ? 'section' : 'div';

	return (
		<RootShell
			id={CONTENT_MANAGER_ROOT_ID}
			ref={rootRef as React.Ref<HTMLDivElement>}
			data-content-manager-root={embeddedMobileLayout ? '1' : undefined}
			data-embedded-mobile={embeddedMobileLayout ? '1' : undefined}
			{...(embedded ? { 'aria-label': t('files.appTitle') } : {})}
			className={cn(
				embedded
					? 'relative flex h-full min-h-0 flex-col bg-(--desktop-surface-app) text-(--desktop-text-primary)'
					: 'min-h-screen bg-(--desktop-surface-app) text-(--desktop-text-primary)',
				embeddedMobileLayout && MOBILE_EMBEDDED_APP_ROOT_CLASS
			)}
			onDragOver={handleRootDragOver}
			onDragLeave={handleRootDragLeave}
			onDrop={handleRootDrop}
		>
			{!embedded ? (
				<>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[radial-gradient(circle_at_0_0,rgba(82,82,91,0.5)_0,transparent_52%),radial-gradient(circle_at_100%_100%,rgba(63,63,70,0.45)_0,transparent_52%)]"
					/>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_0,transparent_46%,rgba(148,163,184,0.28)_47%,transparent_48%,transparent_100%)] bg-size-[32px_32px] mask-[radial-gradient(circle_at_center,black_0,transparent_72%)]"
					/>
				</>
			) : null}

			<AnimatePresence>
				{isDragging && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className={
							embedded
								? 'absolute inset-0 bg-zinc-950/78 backdrop-blur-md flex items-center justify-center'
								: 'fixed inset-0 bg-zinc-950/78 backdrop-blur-md flex items-center justify-center'
						}
						style={{ zIndex: dragOverlayZ }}
					>
						<div className="rounded-(--desktop-radius-xl) border-2 border-dashed border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) p-10 text-center shadow-(--desktop-shadow-panel)">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
								<ArrowUpTrayIcon className="h-8 w-8 text-(--desktop-text-secondary)" />
							</div>
							<p className="text-lg font-semibold text-(--desktop-text-primary)">
								{t('files.dragDropTitle')}
							</p>
							<p className="mt-1 text-sm text-(--desktop-text-muted) antialiased">
								{filesBrowseMode === 'explorer'
									? explorerFolderTarget === 'unfiled'
										? t('files.dragDropHintExplorerUnfiled')
										: t('files.dragDropHintExplorerFolder', {
												folder:
													explorerSelectedFolderName ??
													t('explorer.folderFallbackName'),
											})
									: t('files.dragDropHint')}
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<div
				className={cn(
					'relative flex w-full min-w-0 max-w-none flex-col',
					embedded ? 'h-full min-h-0' : 'min-h-screen'
				)}
			>
				{!showEmbeddedFilesSplit ? (
					<header
						className={cn(
							'sticky top-0 z-10 shrink-0',
							embedded
								? cn(
										'px-3',
										embeddedMobileLayout
											? 'border-b border-(--desktop-border-subtle)/80 py-1'
											: getDesktopShellHeaderStripClassName(shellFrame)
									)
								: 'border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-app)_82%,transparent)] px-4 backdrop-blur-xl sm:px-6 lg:px-8'
						)}
					>
						{embeddedMobileLayout ? (
							<h1 id="content-manager-pro-title" className="sr-only">
								{t('files.appTitle')}
							</h1>
						) : null}
						<div
							className={cn(
								embedded
									? 'flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5'
									: 'flex flex-col flex-wrap gap-3 py-4 sm:gap-4 lg:flex-row lg:items-start lg:justify-between xl:items-center'
							)}
						>
							<div
								className={cn(
									'flex min-w-0 items-center',
									embedded ? 'shrink-0 gap-1.5' : 'flex-1 gap-4',
									embeddedMobileLayout && 'hidden'
								)}
							>
								<div
									className={cn(
										'flex shrink-0 items-center justify-center rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
										embedded
											? 'h-8 w-8 rounded-xl shadow-none'
											: 'h-12 w-12 shadow-(--desktop-shadow-soft)'
									)}
								>
									<FolderOpenIcon
										className={cn(
											'text-(--desktop-text-secondary)',
											embedded ? 'h-4 w-4' : 'h-6 w-6'
										)}
										aria-hidden
									/>
								</div>
								{embedded ? (
									<div className="flex min-w-0 max-w-[min(100%,22rem)] items-baseline gap-1.5 truncate sm:max-w-none">
										<h1
											id="content-manager-pro-title"
											className="shrink-0 truncate text-sm font-semibold tracking-tight text-(--desktop-text-primary)"
										>
											{t('files.appTitle')}
										</h1>
										<span
											className="shrink-0 text-(--desktop-text-muted)"
											aria-hidden
										>
											·
										</span>
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'min-w-0 truncate'
											)}
										>
											{stats != null
												? t('files.subtitleWithSize', {
														count: totalItems,
														size: formatSize(stats.totalSize),
													})
												: t('files.subtitle', { count: totalItems })}
										</p>
									</div>
								) : (
									<div className="min-w-0">
										<h1
											id="content-manager-pro-title"
											className="truncate text-xl font-semibold tracking-tight text-(--desktop-text-primary)"
										>
											{t('files.appTitle')}
										</h1>
										<p className="mt-0.5 text-sm text-(--desktop-text-muted) antialiased">
											{stats != null
												? t('files.subtitleWithSize', {
														count: totalItems,
														size: formatSize(stats.totalSize),
													})
												: t('files.subtitle', { count: totalItems })}
										</p>
									</div>
								)}
							</div>

							<div
								className={cn(
									embedded
										? 'contents'
										: 'flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto lg:max-w-full lg:flex-1 lg:justify-end xl:flex-nowrap'
								)}
							>
								{activeTab !== 'files' ? (
									<ContentManagerTabStrip
										activeTab={activeTab}
										setActiveTab={setActiveTab}
										embedded={embedded}
										embeddedTabIconClass={embeddedTabIconClass}
										shellFrame={shellFrame}
									/>
								) : null}
								<ContentManagerHeaderActions
									embedded={embedded}
									shellFrame={shellFrame}
									fetchContent={fetchContent}
									loading={loading}
									fileInputRef={fileInputRef}
									onFileUploadChange={handleFileSelect}
									uploading={uploading}
									uploadProgress={uploadProgress}
									uploadBatch={uploadBatch}
									onDownloadOwnedArchive={() => setOwnedArchiveModalOpen(true)}
									downloadingOwnedArchive={downloadingOwnedArchive}
									statsLoading={statsLoading}
									ownedFilesCount={ownedFilesCount}
								/>
							</div>
						</div>
					</header>
				) : null}

				<main
					id="content-manager-pro-main"
					aria-labelledby="content-manager-pro-title"
					data-cm-main-inset={
						embedded
							? showEmbeddedFilesSplit
								? embeddedMobileLayout
									? 'mobile-split'
									: 'desktop-split'
								: 'embedded'
							: 'page'
					}
					className={cn(
						'min-h-0 min-w-0 flex-1 overflow-x-hidden transition-all duration-200',
						(embedded || activeTab === 'files') && 'flex min-h-0 flex-col',
						embedded &&
							(showEmbeddedFilesSplit ? 'overflow-hidden' : 'overflow-y-auto'),
						embedded
							? showEmbeddedFilesSplit
								? embeddedMobileLayout
									? 'px-2 py-2'
									: 'px-3 py-3 sm:px-3.5 sm:py-3.5'
								: 'px-3 py-3'
							: 'px-4 py-5 sm:px-6 lg:px-8',
						isDragging &&
							'rounded-2xl border-2 border-dashed border-(--desktop-border-strong)'
					)}
				>
					<AnimatePresence>
						{success && (
							<motion.div
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								className="mb-4"
							>
								<DesktopProductStatusBanner
									tone="success"
									description={
										<span className="flex items-center gap-2">
											<CheckIcon className="w-4 h-4 shrink-0" />
											{success}
										</span>
									}
									actions={
										<DesktopAppButton
											type="button"
											onClick={() => setSuccess(null)}
											variant="ghost"
											size="icon"
											className="h-7 w-7 hover:bg-(--desktop-surface-soft)"
											aria-label={t('files.close')}
										>
											<XMarkIcon className="w-4 h-4" />
										</DesktopAppButton>
									}
								/>
							</motion.div>
						)}
						{error && (
							<motion.div
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								className="mb-4"
							>
								<DesktopProductStatusBanner
									tone="danger"
									description={error}
									actions={
										<DesktopAppButton
											type="button"
											onClick={() => setError(null)}
											variant="ghost"
											size="icon"
											className="h-7 w-7 hover:bg-(--desktop-surface-soft)"
											aria-label={t('files.close')}
										>
											<XMarkIcon className="w-4 h-4" />
										</DesktopAppButton>
									}
								/>
							</motion.div>
						)}
					</AnimatePresence>

					<ContentManagerUploadQueuePanel
						queue={uploadQueue}
						retryFile={retryUploadFile}
						clearQueue={clearUploadQueue}
						uploading={uploading}
						className="mb-4"
					/>

					<ContentManagerProMainSurfaceTabPanels
						t={t}
						activeTab={activeTab}
						setActiveTab={setActiveTab}
						shellContentPanelClass={shellContentPanelClass}
						stats={stats}
						formatSize={formatSize}
						statsLoading={statsLoading}
						statsTabKey={statsTabKey}
						setStatsTabKey={setStatsTabKey}
						managerActivities={managerActivities}
						managerActivityLoading={managerActivityLoading}
						noopUndoActivity={noopUndoActivity}
						viewHistoryEntries={viewHistoryEntries}
						viewHistoryLoading={viewHistoryLoading}
						clearViewHistoryDb={clearViewHistoryDb}
						setPreviewItem={setPreviewItem}
						registerView={registerView}
						quotaBytesUsed={quotaBytesUsed}
						quotaBytesLimit={quotaBytesLimit}
						quotaLoading={quotaLoading}
						quotaError={quotaError}
						onQuotaRetry={onQuotaRetry}
						tagsTabKey={tagsTabKey}
						setTagsTabKey={setTagsTabKey}
						popularTags={popularTags}
						onTagSelect={onTagSelect}
						versionsTabKey={versionsTabKey}
						setVersionsTabKey={setVersionsTabKey}
						versions={versions}
						setVersions={setVersions}
						selectedContent={selectedContent}
						versionsCompanies={versionsCompanies}
						versionsProjects={versionsProjects}
						versionsLoading={versionsLoading}
						selectedContentLoading={selectedContentLoading}
						handleVersionDownload={handleVersionDownload}
						handleVersionRestore={handleVersionRestore}
						setSelectedIds={setSelectedIds}
						setSelectedContentDetails={setSelectedContentDetails}
						multiVersionItems={multiVersionItems}
						multiVersionLoading={multiVersionLoading}
						selectContentForVersionsTab={selectContentForVersionsTab}
						sharedTabKey={sharedTabKey}
						setSharedTabKey={setSharedTabKey}
						sharedContents={sharedContents}
						sharedLoading={sharedLoading}
						handleSharedContentsRefresh={handleSharedContentsRefresh}
						downloadFile={downloadFile}
						openContentById={openContentById}
						commentsTabKey={commentsTabKey}
						setCommentsTabKey={setCommentsTabKey}
						selectedContentId={selectedContentId}
						currentContentUserId={currentContentUserId}
						handleFileCommentsAfterUpdate={handleFileCommentsAfterUpdate}
						duplicatesTabKey={duplicatesTabKey}
						setDuplicatesTabKey={setDuplicatesTabKey}
						handleDuplicateFinderChange={handleDuplicateFinderChange}
						brokenFilesTabKey={brokenFilesTabKey}
						setBrokenFilesTabKey={setBrokenFilesTabKey}
						handleBrokenFilesChange={handleBrokenFilesChange}
						filesBridge={filesBridge}
					/>
				</main>

				<ContentManagerPreviewModal
					item={previewItemResolved}
					embedded={embedded}
					previewViewport={previewViewport}
					onClose={closePreviewModal}
					formatFileSize={formatSize}
					resolveContentTypeLabel={resolveContentTypeLabel}
					onDownload={downloadFile}
					onDelete={
						previewItemResolved?.can_delete === false || !previewItemResolved
							? undefined
							: () => requestDeleteFile(previewItemResolved.id)
					}
					deleteLabel={
						previewItemResolved?.is_owner === false
							? t('pro.preview.remove')
							: t('pro.preview.delete')
					}
					onPrevious={openPreviousPreview}
					onNext={openNextPreview}
					previousDisabled={!previewPreviousItem}
					nextDisabled={!previewNextItem}
					positionLabel={previewPositionLabel}
				/>
				<ContentManagerFolderContextMenu
					target={folderMenuTarget}
					openPosition={folderMenuPos}
					onClose={closeFolderMenu}
					onOpen={setExplorerFolderTarget}
					onNewFolder={(parentItemId) => {
						void createFolderUnderParent(parentItemId);
					}}
					onRename={(itemId, currentName) => {
						void renameExplorerFolder(itemId, currentName);
					}}
					onDelete={(itemId, name) => {
						void deleteExplorerFolder(itemId, name);
					}}
					onRefresh={() => {
						void fetchFolders();
					}}
				/>

				<ContentManagerProModals {...modals} />
			</div>
			{!embeddedMobileLayout ? (
				<ContentManagerGuideModal
					open={contentGuideOpen}
					onClose={() => setContentGuideOpen(false)}
					onPrepareStep={prepareContentGuideStep}
					spotlightLayoutKey={activeTab}
				/>
			) : null}
		</RootShell>
	);
}
