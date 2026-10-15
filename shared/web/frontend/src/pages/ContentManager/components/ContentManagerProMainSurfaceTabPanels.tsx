/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Non-files / files tab panel body for Content Manager Pro MainSurface (F-01 split).
 *
 * Invariants:
 * - Presentation-only; orchestration stays in useContentManagerProController.
 * - Files tab remains bridged via ContentManagerProFilesTabBridge.
 *
 * Related:
 * - ContentManagerProMainSurface.tsx
 * - ContentManagerProFilesTabBridge.tsx
 */
import type { TFunction } from 'i18next';
import { BrokenFilesPanel } from '../../../components/UnifiedContent/components/BrokenFiles';
import { DuplicateFinder } from '../../../components/UnifiedContent/components/DuplicateFinder';
import { FileComments } from '../../../components/UnifiedContent/components/FileComments';
import { SharedTab } from '../../../components/UnifiedContent/components/tabs/SharedTab';
import { VersionsTab } from '../../../components/UnifiedContent/components/tabs/VersionsTab';
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
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSkeleton,
} from '../../Desktop/components/DesktopAppChrome';
import type { ContentManagerTab } from '../contentManagerTypes';
import {
	ContentManagerProFilesTabBridge,
	type ContentManagerProFilesTabBridgeProps,
} from './ContentManagerProFilesTabBridge';
import { ContentManagerStatsTab } from './ContentManagerStatsTab';
import { ContentManagerTabErrorBoundary } from './ContentManagerTabErrorBoundary';
import { ContentManagerTagsTab } from './ContentManagerTagsTab';
import {
	ChatBubbleLeftRightIcon,
	FolderOpenIcon,
} from '@heroicons/react/24/outline';

export type ContentManagerProMainSurfaceTabPanelsProps = {
	t: TFunction<'contentManager'>;
	activeTab: ContentManagerTab;
	setActiveTab: React.Dispatch<React.SetStateAction<ContentManagerTab>>;
	shellContentPanelClass: string;
	stats: ContentStats | null;
	formatSize: (bytes: number) => string;
	statsLoading: boolean;
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
	setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
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
	filesBridge: ContentManagerProFilesTabBridgeProps;
};

export function ContentManagerProMainSurfaceTabPanels({
	t,
	activeTab,
	setActiveTab,
	shellContentPanelClass,
	stats,
	formatSize,
	statsLoading,
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
	setVersions,
	selectedContent,
	versionsCompanies,
	versionsProjects,
	versionsLoading,
	selectedContentLoading,
	handleVersionDownload,
	handleVersionRestore,
	setSelectedIds,
	setSelectedContentDetails,
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
	filesBridge,
}: ContentManagerProMainSurfaceTabPanelsProps): React.ReactElement {
	return (
		<>
			{activeTab === 'stats' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setStatsTabKey((k) => k + 1)}
				>
					<ContentManagerStatsTab
						statsTabKey={statsTabKey}
						shellContentPanelClass={shellContentPanelClass}
						statsLoading={statsLoading}
						stats={stats}
						formatSize={formatSize}
						activities={managerActivities}
						activitiesLoading={managerActivityLoading}
						onUndo={noopUndoActivity}
						viewHistoryEntries={viewHistoryEntries}
						viewHistoryLoading={viewHistoryLoading}
						onClearViewHistory={clearViewHistoryDb}
						setPreviewItem={setPreviewItem}
						registerView={registerView}
						quotaBytesUsed={quotaBytesUsed}
						quotaBytesLimit={quotaBytesLimit}
						quotaLoading={quotaLoading}
						quotaError={quotaError}
						onQuotaRetry={onQuotaRetry}
					/>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'tags' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setTagsTabKey((k) => k + 1)}
				>
					<ContentManagerTagsTab
						tagsTabKey={tagsTabKey}
						shellContentPanelClass={shellContentPanelClass}
						popularTags={popularTags}
						onTagSelect={onTagSelect}
					/>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'versions' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setVersionsTabKey((k) => k + 1)}
				>
					<div className="mb-6">
						<VersionsTab
							key={versionsTabKey}
							versions={versions}
							selectedContent={selectedContent}
							companies={versionsCompanies}
							projects={versionsProjects}
							loading={versionsLoading || selectedContentLoading}
							onVersionDownload={handleVersionDownload}
							onVersionRestore={handleVersionRestore}
							onClearSelection={() => {
								setSelectedIds(new Set());
								setPreviewItem(null);
								setSelectedContentDetails(null);
								setVersions([]);
							}}
							multiVersionItems={multiVersionItems}
							multiVersionLoading={multiVersionLoading}
							onSelectMultiVersionFile={selectContentForVersionsTab}
						/>
					</div>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'shared' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setSharedTabKey((k) => k + 1)}
				>
					<div className="mb-6">
						<SharedTab
							key={sharedTabKey}
							sharedContents={sharedContents}
							loading={sharedLoading}
							onRefresh={handleSharedContentsRefresh}
							onDownload={downloadFile}
							onPreview={(id) => void openContentById(id)}
						/>
					</div>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'comments' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setCommentsTabKey((k) => k + 1)}
				>
					<div className="mb-6" key={commentsTabKey}>
						{!selectedContentId ? (
							<div className={cn(shellContentPanelClass, 'min-h-0 p-6')}>
								<DesktopAppEmptyState
									icon={
										<ChatBubbleLeftRightIcon className="h-8 w-8 text-(--desktop-text-dim)" />
									}
									title={t('files.comments.pickFileTitle')}
									description={t('files.comments.pickFileDesc')}
								>
									<DesktopAppButton
										type="button"
										variant="accent"
										onClick={() => setActiveTab('files')}
									>
										<FolderOpenIcon className="h-4 w-4" />
										{t('files.comments.browseFiles')}
									</DesktopAppButton>
								</DesktopAppEmptyState>
								{viewHistoryEntries.length > 0 ? (
									<div className="mt-6 border-t border-(--desktop-border-subtle) pt-5">
										<h4 className="mb-3 text-sm font-medium text-(--desktop-text-secondary)">
											{t('files.comments.recentPickTitle')}
										</h4>
										<ul className="space-y-1">
											{viewHistoryEntries.slice(0, 8).map((entry) => (
												<li key={entry.content.id}>
													<DesktopAppButton
														type="button"
														variant="ghost"
														className="h-auto w-full justify-start px-3 py-2 text-left text-sm"
														onClick={() => {
															void openContentById(entry.content.id);
															setActiveTab('comments');
														}}
													>
														<span className="truncate">
															{entry.content.name}
														</span>
													</DesktopAppButton>
												</li>
											))}
										</ul>
									</div>
								) : null}
							</div>
						) : selectedContentLoading && !selectedContent ? (
							<div className="space-y-3">
								<DesktopAppSkeleton className="h-32" />
								<DesktopAppSkeleton className="h-40" />
							</div>
						) : selectedContent ? (
							<FileComments
								content={selectedContent}
								currentUserId={currentContentUserId}
								onUpdate={handleFileCommentsAfterUpdate}
							/>
						) : (
							<DesktopAppErrorState message={t('files.comments.loadError')} />
						)}
					</div>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'duplicates' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setDuplicatesTabKey((k) => k + 1)}
				>
					<div className="mb-6">
						<DuplicateFinder
							key={duplicatesTabKey}
							onChange={handleDuplicateFinderChange}
						/>
					</div>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'brokenFiles' && (
				<ContentManagerTabErrorBoundary
					recoveryTitle={t('tabPanel.loadErrorTitle')}
					recoveryLabel={t('tabPanel.retry')}
					onRecovery={() => setBrokenFilesTabKey((k) => k + 1)}
				>
					<div className="mb-6">
						<BrokenFilesPanel
							key={brokenFilesTabKey}
							onChange={handleBrokenFilesChange}
						/>
					</div>
				</ContentManagerTabErrorBoundary>
			)}

			{activeTab === 'files' ? (
				<ContentManagerProFilesTabBridge {...filesBridge} />
			) : null}
		</>
	);
}
