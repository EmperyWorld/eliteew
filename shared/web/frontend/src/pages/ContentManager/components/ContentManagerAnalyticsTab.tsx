/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Storage quota visualization for Content Manager stats — single source of truth from /content/quota/me.
 *
 * Invariants:
 * - Never hardcode quota limits; used/limit bytes come from API props only.
 * - Loading, error, and unlimited-quota states are shown honestly to the user.
 *
 * Related:
 * - ContentManagerStatsTab.tsx
 * - hooks/useContentManagerQuota.ts
 */
import * as React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { ArrowPathIcon, CircleStackIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import {
	DesktopAppButton,
	DesktopAppSkeleton,
	DesktopProductStatusBanner,
} from '../../Desktop/components/DesktopAppChrome';

function QuotaPercentBar({
	pct,
	className,
}: {
	pct: number;
	className?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${pct}%`;
	}, [pct]);
	return (
		<div
			ref={ref}
			className={cn(
				'h-2.5 rounded-full bg-(--desktop-accent-primary) transition-[width] duration-500 ease-out motion-reduce:transition-none',
				className
			)}
		/>
	);
}

export interface ContentManagerAnalyticsTabProps {
	shellContentPanelClass: string;
	formatSize: (bytes: number) => string;
	quotaBytesUsed: number | null;
	quotaBytesLimit: number | null;
	quotaLoading: boolean;
	quotaError: string | null;
	onQuotaRetry: () => void | Promise<void>;
}

export const ContentManagerAnalyticsTab: React.FC<
	ContentManagerAnalyticsTabProps
> = ({
	shellContentPanelClass,
	formatSize,
	quotaBytesUsed,
	quotaBytesLimit,
	quotaLoading,
	quotaError,
	onQuotaRetry,
}) => {
	const { t } = useTranslation('contentManager');

	const hasLimit =
		quotaBytesLimit != null && quotaBytesLimit > 0 && quotaBytesUsed != null;
	const hasUsedOnly =
		quotaBytesUsed != null && (quotaBytesLimit == null || quotaBytesLimit <= 0);
	const usagePercent =
		hasLimit && quotaBytesUsed != null && quotaBytesLimit != null
			? Math.min((quotaBytesUsed / quotaBytesLimit) * 100, 100)
			: null;

	return (
		<section
			className={cn(shellContentPanelClass, 'space-y-4 p-5')}
			aria-labelledby="content-manager-storage-quota-title"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3
						id="content-manager-storage-quota-title"
						className="text-base font-semibold text-(--desktop-text-primary)"
					>
						{t('files.stats.storageTitle')}
					</h3>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}>
						{t('files.stats.storageSubtitle')}
					</p>
				</div>
				<div
					className={cn(
						'shrink-0 rounded-xl p-2.5',
						'bg-(--desktop-surface-soft) text-(--desktop-text-secondary)'
					)}
					aria-hidden
				>
					<CircleStackIcon className="h-5 w-5" />
				</div>
			</div>

			{quotaLoading ? (
				<div className="space-y-3" aria-busy="true">
					<DesktopAppSkeleton className="h-4 w-48" />
					<DesktopAppSkeleton className="h-2.5 w-full rounded-full" />
					<DesktopAppSkeleton className="h-3 w-24" />
				</div>
			) : quotaError ? (
				<DesktopProductStatusBanner
					tone="warning"
					description={t('files.stats.quotaLoadError')}
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1.5"
							onClick={() => void onQuotaRetry()}
						>
							<ArrowPathIcon className="h-4 w-4" aria-hidden />
							{t('files.stats.quotaRetry')}
						</DesktopAppButton>
					}
				/>
			) : hasLimit ? (
				<div className="space-y-2">
					<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
						<span className="text-(--desktop-text-muted)">
							{t('files.stats.quotaUsedLabel')}
						</span>
						<span className="font-medium tabular-nums text-(--desktop-text-primary)">
							{t('files.stats.quotaUsage', {
								used: formatSize(quotaBytesUsed),
								limit: formatSize(quotaBytesLimit),
							})}
						</span>
					</div>
					<div
						className="w-full rounded-full bg-(--desktop-surface-soft)"
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={usagePercent ?? 0}
						aria-label={t('files.stats.quotaUsage', {
							used: formatSize(quotaBytesUsed),
							limit: formatSize(quotaBytesLimit),
						})}
					>
						<QuotaPercentBar pct={usagePercent ?? 0} />
					</div>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'tabular-nums')}>
						{t('files.stats.quotaPercent', {
							percent: (usagePercent ?? 0).toFixed(1),
						})}
					</p>
				</div>
			) : hasUsedOnly ? (
				<p className="text-sm text-(--desktop-text-primary)">
					{t('files.stats.quotaUsedOnly', {
						used: formatSize(quotaBytesUsed),
					})}
				</p>
			) : (
				<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
					{t('files.stats.quotaUnavailable')}
				</p>
			)}
		</section>
	);
};
