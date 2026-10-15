/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stats tab: summary cards, storage quota analytics, activity log, and view history.
 *
 * Invariants:
 * - Storage quota display uses /content/quota/me values passed from hooks, never hardcoded limits.
 *
 * Related:
 * - ContentManagerAnalyticsTab.tsx
 * - hooks/useContentManagerQuota.ts
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityLog } from '../../../components/UnifiedContent/components/ActivityLog';
import { ViewHistory } from '../../../components/UnifiedContent/components/ViewHistory';
import type { Activity } from '../../../components/UnifiedContent/hooks/useActivityLog';
import type {
	Content as ContentItem,
	ContentStats,
} from '../../../components/UnifiedContent/types';
import type { ContentViewHistoryApiItem } from '../../../services/contentApi';
import { cn } from '../../../utils/cn';
import { DesktopAppSkeleton } from '../../Desktop/components/DesktopAppChrome';
import { ContentManagerAnalyticsTab } from './ContentManagerAnalyticsTab';
import { StatsCard } from './ContentManagerStatsCard';
import {
	ArrowTrendingUpIcon,
	BoltIcon,
	FolderIcon,
	ServerIcon,
} from '@heroicons/react/24/outline';

export interface ContentManagerStatsTabProps {
	statsTabKey: number;
	shellContentPanelClass: string;
	statsLoading: boolean;
	stats: ContentStats | null;
	formatSize: (bytes: number) => string;
	activities: Activity[];
	activitiesLoading?: boolean;
	onUndo: (activityId?: string) => Promise<boolean>;
	viewHistoryEntries: ContentViewHistoryApiItem[];
	viewHistoryLoading?: boolean;
	onClearViewHistory: () => void | Promise<void>;
	setPreviewItem: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	registerView: (item: ContentItem) => void | Promise<void>;
	quotaBytesUsed?: number | null;
	quotaBytesLimit?: number | null;
	quotaLoading?: boolean;
	quotaError?: string | null;
	onQuotaRetry?: () => void | Promise<void>;
}

export const ContentManagerStatsTab: React.FC<ContentManagerStatsTabProps> = ({
	statsTabKey,
	shellContentPanelClass,
	statsLoading,
	stats,
	formatSize,
	activities,
	activitiesLoading = false,
	onUndo,
	viewHistoryEntries,
	viewHistoryLoading = false,
	onClearViewHistory,
	setPreviewItem,
	registerView,
	quotaBytesUsed = null,
	quotaBytesLimit = null,
	quotaLoading = false,
	quotaError = null,
	onQuotaRetry = () => undefined,
}) => {
	const { t } = useTranslation('contentManager');

	return (
		<div key={statsTabKey} className="mb-6 space-y-6">
			<ContentManagerAnalyticsTab
				shellContentPanelClass={shellContentPanelClass}
				formatSize={formatSize}
				quotaBytesUsed={quotaBytesUsed}
				quotaBytesLimit={quotaBytesLimit}
				quotaLoading={quotaLoading}
				quotaError={quotaError}
				onQuotaRetry={onQuotaRetry}
			/>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{statsLoading ? (
					(
						['stats-sk-0', 'stats-sk-1', 'stats-sk-2', 'stats-sk-3'] as const
					).map((kid) => (
						<div
							key={kid}
							className={cn(
								shellContentPanelClass,
								'flex min-h-0 items-center gap-4 p-4'
							)}
						>
							<DesktopAppSkeleton className="h-12 w-12 shrink-0 rounded-xl" />
							<div className="min-w-0 flex-1 space-y-2">
								<DesktopAppSkeleton className="h-6 w-16" />
								<DesktopAppSkeleton className="h-4 w-24" />
							</div>
						</div>
					))
				) : (
					<>
						<StatsCard
							title={t('files.stats.totalFiles')}
							value={stats?.totalFiles ?? 0}
							icon={
								<FolderIcon className="w-5 h-5 text-(--desktop-text-secondary)" />
							}
						/>
						<StatsCard
							title={t('files.stats.totalSize')}
							value={stats != null ? formatSize(stats.totalSize) : '—'}
							icon={
								<ServerIcon className="w-5 h-5 text-(--desktop-text-secondary)" />
							}
						/>
						<StatsCard
							title={t('files.stats.week')}
							value={stats?.recentActivity || 0}
							icon={
								<ArrowTrendingUpIcon className="w-5 h-5 text-(--desktop-text-secondary)" />
							}
						/>
						<StatsCard
							title={t('files.stats.typesCount')}
							value={
								stats != null ? Object.keys(stats.typeDistribution).length : '—'
							}
							icon={
								<BoltIcon className="w-5 h-5 text-(--desktop-text-secondary)" />
							}
						/>
					</>
				)}
			</div>
			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<div className={cn(shellContentPanelClass, 'min-h-0 p-5')}>
					<ActivityLog
						activities={activities}
						canUndo={false}
						onUndo={onUndo}
						loading={activitiesLoading}
						emptyHint={t('activityLog.emptyHintAudit')}
						maxVisible={10}
					/>
				</div>
				<div className={cn(shellContentPanelClass, 'min-h-0 p-5')}>
					<ViewHistory
						entries={viewHistoryEntries}
						loading={viewHistoryLoading}
						onSelect={(content) => {
							setPreviewItem(content);
							void registerView(content);
						}}
						onClear={onClearViewHistory}
						maxItems={10}
					/>
				</div>
			</div>
		</div>
	);
};
