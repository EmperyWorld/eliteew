/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Account pulse on Profile Home — mini stats + recent activity preview.
 *
 * Invariants:
 * - Stats/activity failures degrade locally; they never blank the rest of Home.
 * - Full activity opens the activity sheet (not a peer «Ещё» room).
 * - Pulse section eyebrows stay sentence-case (`SH_SECTION_EYEBROW_CLASS`).
 *
 * Related:
 * - ProfileHome.tsx
 * - @/components/profile/ProfileActivityPanel.tsx
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	ChartBarIcon,
	ClockIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import profileService from '@/services/profileService';
import type {
	ActivityLogEntry,
	UserStatistics as UserStatisticsType,
} from '@/types/profile';
import { formatRelativeTime } from '@/types/profile';
import { log } from '@/utils/logger';

import { SH_SECTION_EYEBROW_CLASS } from '../layout/socialHubLayoutTokens';

export default function ProfileAccountPulse({
	activityRefreshKey = 0,
	onOpenActivity,
}: {
	activityRefreshKey?: number;
	onOpenActivity: () => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const [statistics, setStatistics] = useState<UserStatisticsType | null>(null);
	const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
	const [statsError, setStatsError] = useState(false);
	const [activityError, setActivityError] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		// Parent bumps activityRefreshKey after profile edits — must re-fetch pulse.
		const refreshGeneration = activityRefreshKey;
		void (async () => {
			const [statsResult, activityResult] = await Promise.allSettled([
				profileService.getStatistics(),
				profileService.getActivityLog(1, 3),
			]);
			if (cancelled || refreshGeneration !== activityRefreshKey) return;

			if (statsResult.status === 'fulfilled') {
				setStatistics(statsResult.value);
				setStatsError(false);
			} else {
				setStatistics(null);
				setStatsError(true);
				log.error(
					'ProfileAccountPulse',
					'statistics load failed',
					statsResult.reason instanceof Error ? statsResult.reason : undefined,
					statsResult.reason
				);
			}

			if (activityResult.status === 'fulfilled') {
				setActivities(activityResult.value.activities.slice(0, 3));
				setActivityError(false);
			} else {
				setActivities([]);
				setActivityError(true);
				log.error(
					'ProfileAccountPulse',
					'activity load failed',
					activityResult.reason instanceof Error
						? activityResult.reason
						: undefined,
					activityResult.reason
				);
			}
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [activityRefreshKey]);

	return (
		<section className="space-y-3" aria-labelledby="profile-home-pulse-heading">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3
					id="profile-home-pulse-heading"
					className="flex items-center gap-2 text-base font-semibold text-(--desktop-text-primary)"
				>
					<ChartBarIcon
						className="h-5 w-5 text-(--desktop-accent)"
						aria-hidden
					/>
					{t('friends.profileHomePulseTitle')}
				</h3>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="gap-2"
					onClick={onOpenActivity}
				>
					<ClockIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.profileHomePulseSeeActivity')}
				</DesktopAppButton>
			</div>

			{loading ? (
				<DesktopAppPanel className="flex items-center gap-2 p-4 text-sm text-(--desktop-text-muted)">
					<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					{t('friends.profileHomePulseLoading')}
				</DesktopAppPanel>
			) : (
				<div className="grid gap-3 lg:grid-cols-2">
					<DesktopAppPanel className="space-y-2 p-4">
						<div className={SH_SECTION_EYEBROW_CLASS}>
							{t('friends.profileHomePulseStatsLabel')}
						</div>
						{statsError || !statistics ? (
							<p className="text-sm text-(--desktop-text-muted)">
								{t('friends.profileHomePulseStatsError')}
							</p>
						) : (
							<ul className="grid gap-1.5 text-sm text-(--desktop-text-secondary)">
								<li>
									{t('friends.profileHomePulseStatAge', {
										days: statistics.account_age_days,
									})}
								</li>
								<li>
									{t('friends.profileHomePulseStatContent', {
										count: statistics.total_content_items,
									})}
								</li>
								<li>
									{t('friends.profileHomePulseStatStorage', {
										used: Math.round(statistics.storage_used_mb),
										quota: Math.round(statistics.storage_quota_mb),
									})}
								</li>
								<li>
									{t('friends.profileHomePulseStatAi', {
										rate: Math.round(statistics.ai_success_rate),
									})}
								</li>
							</ul>
						)}
					</DesktopAppPanel>

					<DesktopAppPanel className="space-y-2 p-4">
						<div className={SH_SECTION_EYEBROW_CLASS}>
							{t('friends.profileHomePulseActivityLabel')}
						</div>
						{activityError ? (
							<p className="text-sm text-(--desktop-text-muted)">
								{t('friends.profileHomePulseActivityError')}
							</p>
						) : activities.length === 0 ? (
							<p className="text-sm text-(--desktop-text-muted)">
								{t('friends.profileHomePulseActivityEmpty')}
							</p>
						) : (
							<ul className="space-y-2">
								{activities.map((item) => (
									<li
										key={item.id}
										className="border-b border-(--desktop-border-subtle)/60 pb-2 last:border-0 last:pb-0"
									>
										<div className="text-sm text-(--desktop-text-primary)">
											{item.description?.trim() || item.action}
										</div>
										<div className="text-xs text-(--desktop-text-muted)">
											{formatRelativeTime(item.created_at)}
										</div>
									</li>
								))}
							</ul>
						)}
					</DesktopAppPanel>
				</div>
			)}
		</section>
	);
}
