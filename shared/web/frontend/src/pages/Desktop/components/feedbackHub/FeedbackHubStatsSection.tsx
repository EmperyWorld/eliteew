/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quota and team-recognition summary cards for Feedback Hub.
 *
 * Invariants:
 * - Renders only when summary payload is present; aria-labels include live counts.
 *
 * Related:
 * - FeedbackHubApp.tsx · FEEDBACK-HUB.md · productDesktopApi.ts
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	BugAntIcon,
	LightBulbIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type { FeedbackSummary } from '../../services/productDesktopApi';
import { isFeedbackQuotaNearLimit } from '../../utils/feedbackHubSubmitGate';
import { DesktopAppSurface } from '../DesktopAppChrome';

export type FeedbackHubStatsSectionProps = {
	embeddedMobileLayout: boolean;
	summary: FeedbackSummary;
};

export function FeedbackHubStatsSection({
	embeddedMobileLayout,
	summary,
}: FeedbackHubStatsSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'feedbackHub' });
	const wishQuotaNear = isFeedbackQuotaNearLimit(
		summary.wish_count,
		summary.wish_limit
	);
	const bugQuotaNear = isFeedbackQuotaNearLimit(
		summary.bug_count,
		summary.bug_limit
	);

	return (
		<div
			className={cn(
				'grid grid-cols-1 gap-2',
				!embeddedMobileLayout && 'sm:grid-cols-3'
			)}
			data-feedback-hub-guide="stats"
		>
			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className={cn(
					'min-w-0 transition-shadow duration-200 motion-reduce:transition-none hover:shadow-(--desktop-shadow-soft)',
					wishQuotaNear && 'ring-1 ring-amber-500/35'
				)}
				aria-label={t('statWishAria', {
					current: summary.wish_count,
					max: summary.wish_limit,
				})}
			>
				<div className="flex items-start gap-3">
					<div
						className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-2 ring-1 ring-white/5"
						aria-hidden
					>
						<LightBulbIcon
							className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</div>
					<div className="min-w-0">
						<p className={DESKTOP_TYPOGRAPHY.caption}>{t('statIdeasTitle')}</p>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.title,
								'mt-1 text-xl tabular-nums'
							)}
						>
							{t('counterOf', {
								current: summary.wish_count,
								max: summary.wish_limit,
							})}
						</p>
						<p className={`mt-1 ${DESKTOP_TYPOGRAPHY.meta}`}>
							{t('statIdeasSub')}
						</p>
					</div>
				</div>
			</DesktopAppSurface>
			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className={cn(
					'min-w-0 transition-shadow duration-200 motion-reduce:transition-none hover:shadow-(--desktop-shadow-soft)',
					bugQuotaNear && 'ring-1 ring-amber-500/35'
				)}
				aria-label={t('statBugAria', {
					current: summary.bug_count,
					max: summary.bug_limit,
				})}
			>
				<div className="flex items-start gap-3">
					<div
						className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-2 ring-1 ring-white/5"
						aria-hidden
					>
						<BugAntIcon
							className="h-5 w-5 text-rose-300/90"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</div>
					<div className="min-w-0">
						<p className={DESKTOP_TYPOGRAPHY.caption}>{t('statBugsTitle')}</p>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.title,
								'mt-1 text-xl tabular-nums'
							)}
						>
							{t('counterOf', {
								current: summary.bug_count,
								max: summary.bug_limit,
							})}
						</p>
						<p className={`mt-1 ${DESKTOP_TYPOGRAPHY.meta}`}>
							{t('statBugsSub')}
						</p>
					</div>
				</div>
			</DesktopAppSurface>
			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className="min-w-0 transition-shadow duration-200 motion-reduce:transition-none hover:shadow-(--desktop-shadow-soft)"
				aria-label={t('statRecognitionAria', {
					total: Math.round(summary.team_recognition_total * 100) / 100,
				})}
			>
				<div className="flex items-start gap-3">
					<div
						className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-2 ring-1 ring-white/5"
						aria-hidden
					>
						<SparklesIcon
							className="h-5 w-5 text-amber-300/50"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</div>
					<div className="min-w-0">
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('statRecognitionTitle')}
						</p>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.title,
								'mt-1 text-xl tabular-nums'
							)}
						>
							{Math.round(summary.team_recognition_total * 100) / 100}
						</p>
						<p className={`mt-1 ${DESKTOP_TYPOGRAPHY.meta}`}>
							{t('statRecognitionSub')}
						</p>
					</div>
				</div>
			</DesktopAppSurface>
		</div>
	);
}
