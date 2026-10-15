/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact guided cockpit for Site Studio: next best action, progress strip, blockers, and apply summary.
 *
 * Invariants:
 * - Consumes the pure journey model; all navigation/runtime side effects are delegated through `onAction`.
 * - User copy stays high-level and avoids queue/UGS/operator internals.
 *
 * Related:
 * - features/site-studio/desktop/siteStudioUserJourney.ts
 * - features/site-studio/desktop/UserSiteStudioApp.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';

import type {
	SiteStudioJourneyAction,
	SiteStudioJourneyModel,
} from '../siteStudioUserJourney';

interface SiteStudioGuidedCockpitProps {
	journey: SiteStudioJourneyModel;
	onAction: (action: SiteStudioJourneyAction) => void;
}

function progressTone(status: string): string {
	if (status === 'done') return 'bg-emerald-400/70';
	if (status === 'current') return 'bg-[rgb(var(--desktop-accent-rgb))]';
	if (status === 'blocked') return 'bg-red-400/75';
	return 'bg-(--desktop-border-subtle)';
}

export const SiteStudioGuidedCockpit: React.FC<
	SiteStudioGuidedCockpitProps
> = ({ journey, onAction }) => {
	const { t } = useTranslation('siteStudio');
	const isBlocked = journey.stage === 'blocked';
	const applyNeedsReview = Boolean(journey.applySummary?.needsReview);
	const applyHasFailures = (journey.applySummary?.failed ?? 0) > 0;

	return (
		<DesktopAppPanel className="shrink-0 space-y-3 p-3">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1 space-y-1">
					<DesktopAppSectionLabel>
						{t('journey.cockpitLabel')}
					</DesktopAppSectionLabel>
					<div className="flex items-center gap-2">
						{isBlocked ? (
							<ExclamationTriangleIcon
								className="h-5 w-5 shrink-0 text-amber-200"
								aria-hidden
							/>
						) : (
							<SparklesIcon
								className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
								aria-hidden
							/>
						)}
						<h2 className="text-base font-semibold text-(--desktop-text-primary)">
							{t(journey.titleKey)}
						</h2>
					</div>
					<p className="max-w-4xl text-sm leading-6 text-(--desktop-text-secondary)">
						{journey.blockerKey
							? t(journey.blockerKey)
							: t(journey.descriptionKey)}
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					{journey.primaryAction ? (
						<DesktopAppButton
							type="button"
							variant={isBlocked ? 'neutral' : 'accent'}
							onClick={() =>
								onAction(journey.primaryAction as SiteStudioJourneyAction)
							}
						>
							{isBlocked ? (
								<ArrowPathIcon className="h-4 w-4" aria-hidden />
							) : (
								<SparklesIcon className="h-4 w-4" aria-hidden />
							)}
							{t(journey.primaryAction.labelKey)}
						</DesktopAppButton>
					) : null}
					{journey.secondaryActions.map((action) => (
						<DesktopAppButton
							key={`${action.kind}-${action.labelKey}`}
							type="button"
							variant="ghost"
							onClick={() => onAction(action)}
						>
							{t(action.labelKey)}
						</DesktopAppButton>
					))}
				</div>
			</div>

			{applyNeedsReview && journey.applySummary ? (
				<DesktopProductStatusBanner
					tone={applyHasFailures ? 'danger' : 'warning'}
					role={applyHasFailures ? 'alert' : 'status'}
					aria-live={applyHasFailures ? 'assertive' : 'polite'}
					title={
						applyHasFailures
							? t('journey.applyReview.failedTitle')
							: t('journey.applyReview.warningTitle')
					}
					description={t('journey.applyReview.description', {
						applied: journey.applySummary.applied,
						skipped: journey.applySummary.skipped,
						failed: journey.applySummary.failed,
					})}
					actions={
						journey.primaryAction ? (
							<DesktopAppButton
								type="button"
								size="sm"
								variant={applyHasFailures ? 'neutral' : 'accent'}
								onClick={() =>
									onAction(journey.primaryAction as SiteStudioJourneyAction)
								}
							>
								{t(journey.primaryAction.labelKey)}
							</DesktopAppButton>
						) : null
					}
				/>
			) : null}

			{/* Compact strip only — full stage list lives in header (single progress owner). */}
			<div className="grid gap-3 lg:grid-cols-[1fr_auto]">
				<ul
					className="m-0 grid list-none grid-cols-6 gap-1 p-0"
					aria-label={t('journey.progressAria')}
				>
					{journey.steps.map((step) => (
						<li key={step.id} className="space-y-1">
							<div
								className={cn('h-1.5 rounded-full', progressTone(step.status))}
								aria-hidden
							/>
							<div className="truncate text-[10px] text-(--desktop-text-dim)">
								{t(step.titleKey)}
							</div>
						</li>
					))}
				</ul>
				<DesktopAppSurface
					variant="soft"
					padding="sm"
					className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)"
				>
					<CheckCircleIcon className="h-4 w-4 text-emerald-200" aria-hidden />
					<span>
						{t('journey.progressSummary', {
							done: journey.progressDone,
							total: journey.progressTotal,
						})}
					</span>
					{journey.applySummary ? (
						<span className="text-(--desktop-text-dim)">
							·{' '}
							{t('journey.applySummary', {
								applied: journey.applySummary.applied,
								skipped: journey.applySummary.skipped,
								failed: journey.applySummary.failed,
							})}
						</span>
					) : null}
				</DesktopAppSurface>
			</div>
		</DesktopAppPanel>
	);
};

export default SiteStudioGuidedCockpit;
