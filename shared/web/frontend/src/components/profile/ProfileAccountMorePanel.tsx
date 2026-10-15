/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Secondary account surfaces (statistics / activity) for premium User Profile shell.
 *
 * Invariants:
 * - Never presented as equal peer to privacy/identity primary panes.
 *
 * Related:
 * - ../UserProfile.tsx
 * - UserStatistics.tsx
 * - ProfileActivityPanel.tsx
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	ChartBarSquareIcon,
	CircleStackIcon,
	SignalIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import profileService from '@/services/profileService';
import type { UserStatistics as UserStatisticsType } from '@/types/profile';
import { cn } from '@/utils/cn';
import { log } from '@/utils/logger';
import { RetryBlock } from '@/components/ui/RetryBlock';

const UserStatistics = React.lazy(() => import('./UserStatistics'));
const ProfileActivityPanel = React.lazy(() => import('./ProfileActivityPanel'));
const ProfileMemoryCellsPanel = React.lazy(
	() => import('./ProfileMemoryCellsPanel')
);

export type AccountMoreSubPane = 'statistics' | 'activity' | 'memoryCells';

export default function ProfileAccountMorePanel({
	embedded = false,
	subPane,
	onSubPaneChange,
	activityRefreshKey,
}: {
	embedded?: boolean;
	subPane: AccountMoreSubPane;
	onSubPaneChange: (pane: AccountMoreSubPane) => void;
	activityRefreshKey: number;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const [statistics, setStatistics] = useState<UserStatisticsType | null>(null);
	const [statisticsError, setStatisticsError] = useState<string | null>(null);
	const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);

	const loadStatistics = useCallback(async () => {
		setStatisticsError(null);
		setIsLoadingStatistics(true);
		try {
			const data = await profileService.getStatistics();
			setStatistics(data);
		} catch (err: unknown) {
			log.error(
				'ProfileAccountMorePanel',
				'Failed to load statistics',
				err instanceof Error ? err : undefined,
				err
			);
			const message =
				err &&
				typeof err === 'object' &&
				'response' in err &&
				err.response &&
				typeof err.response === 'object' &&
				'data' in err.response &&
				err.response.data &&
				typeof err.response.data === 'object' &&
				'message' in err.response.data &&
				typeof (err.response.data as { message: unknown }).message === 'string'
					? (err.response.data as { message: string }).message
					: t('friends.socialHubProfileStatsError');
			setStatisticsError(message);
		} finally {
			setIsLoadingStatistics(false);
		}
	}, [t]);

	useEffect(() => {
		if (subPane === 'statistics') {
			void loadStatistics();
		}
	}, [subPane, loadStatistics]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					size="sm"
					variant={subPane === 'statistics' ? 'neutral' : 'ghost'}
					onClick={() => onSubPaneChange('statistics')}
					className="gap-2"
				>
					<ChartBarSquareIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubProfileMoreStats')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant={subPane === 'activity' ? 'neutral' : 'ghost'}
					onClick={() => onSubPaneChange('activity')}
					className="gap-2"
				>
					<SignalIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubProfileMoreActivity')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant={subPane === 'memoryCells' ? 'neutral' : 'ghost'}
					onClick={() => onSubPaneChange('memoryCells')}
					className="gap-2"
				>
					<CircleStackIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubProfileMoreMemoryCells')}
				</DesktopAppButton>
			</div>

			<React.Suspense
				fallback={
					<div className="space-y-3">
						<DesktopAppSkeleton className="h-20 rounded-(--desktop-radius-lg)" />
						<DesktopAppSkeleton className="h-40 rounded-(--desktop-radius-lg)" />
					</div>
				}
			>
				{subPane === 'statistics' ? (
					isLoadingStatistics ? (
						<div
							className="flex min-w-0 items-center justify-center py-16"
							role="status"
							aria-live="polite"
							aria-label={t('friends.socialHubProfileStatsLoadingAria')}
						>
							<ArrowPathIcon
								className="h-8 w-8 shrink-0 animate-spin text-slate-400"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</div>
					) : statisticsError && !statistics ? (
						<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
							<RetryBlock
								message={statisticsError}
								onRetry={loadStatistics}
								retryLabel={t('friends.networkRetry')}
							/>
						</DesktopAppPanel>
					) : statistics ? (
						<div className="min-w-0 space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle) pb-3">
								<p className="min-w-0 text-sm text-(--desktop-text-muted)">
									{t('friends.socialHubProfileStatsHint')}
								</p>
								<DesktopAppButton
									type="button"
									onClick={() => void loadStatistics()}
									disabled={isLoadingStatistics}
									variant="accent"
									size="sm"
									className="shrink-0"
								>
									{isLoadingStatistics
										? t('friends.socialHubProfileRefreshing')
										: t('friends.socialHubProfileRefresh')}
								</DesktopAppButton>
							</div>
							<UserStatistics embedded={embedded} statistics={statistics} />
						</div>
					) : null
				) : subPane === 'memoryCells' ? (
					<ProfileMemoryCellsPanel embedded={embedded} />
				) : (
					<ProfileActivityPanel
						embedded={embedded}
						refreshKey={activityRefreshKey}
					/>
				)}
			</React.Suspense>
		</div>
	);
}
