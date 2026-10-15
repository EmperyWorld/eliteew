/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Actionable Site Studio journey checklist that turns readiness steps into guided next actions.
 *
 * Invariants:
 * - Step status comes from `siteStudioUserJourney`; this component only renders and dispatches actions.
 * - Internal worker/queue diagnostics stay out of normal checklist copy.
 *
 * Related:
 * - features/site-studio/desktop/siteStudioUserJourney.ts
 * - features/site-studio/desktop/UserSiteStudioApp.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	CheckCircleIcon,
	DocumentTextIcon,
	EllipsisHorizontalCircleIcon,
	GlobeAltIcon,
	PhotoIcon,
	RocketLaunchIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';

import {
	type SiteStudioJourneyAction,
	type SiteStudioJourneyModel,
	type SiteStudioJourneyStepId,
} from '../siteStudioUserJourney';

interface SiteStudioChecklistProps {
	journey: SiteStudioJourneyModel;
	onAction: (action: SiteStudioJourneyAction) => void;
}

const STEP_ICONS: Record<SiteStudioJourneyStepId, React.ReactNode> = {
	setup: <DocumentTextIcon className="h-4 w-4" />,
	ai_fill: <SparklesIcon className="h-4 w-4" />,
	review: <DocumentTextIcon className="h-4 w-4" />,
	media: <PhotoIcon className="h-4 w-4" />,
	runtime: <RocketLaunchIcon className="h-4 w-4" />,
	publish: <GlobeAltIcon className="h-4 w-4" />,
};

function statusClass(status: string): string {
	if (status === 'done') return 'bg-emerald-500/15 text-emerald-200';
	if (status === 'current')
		return 'bg-[rgb(var(--desktop-accent-rgb)/0.18)] text-(--desktop-text-primary)';
	if (status === 'blocked') return 'bg-red-500/15 text-red-100';
	return 'bg-(--desktop-surface-soft-hover) text-(--desktop-text-muted)';
}

export const SiteStudioChecklist: React.FC<SiteStudioChecklistProps> = ({
	journey,
	onAction,
}) => {
	const { t } = useTranslation('siteStudio');

	return (
		<DesktopAppPanel className="space-y-4 p-4">
			<div className="space-y-2">
				<h2
					id="site-studio-checklist-title"
					className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
				>
					{t('checklist.title')}
				</h2>
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{t('checklist.intro')}
				</p>
			</div>

			<ul
				className="m-0 grid list-none grid-cols-1 gap-3 p-0"
				aria-labelledby="site-studio-checklist-title"
			>
				{journey.steps.map((item) => (
					<li key={item.id} className="list-none">
						<DesktopAppSurface
							variant="soft"
							padding="sm"
							className={cn(
								'flex items-start gap-3',
								item.status === 'current' &&
									'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent)/30',
								item.status === 'blocked' && 'border-red-500/30 bg-red-500/8'
							)}
						>
							<div
								className={cn(
									'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
									statusClass(item.status)
								)}
								aria-hidden
							>
								{item.status === 'done' ? (
									<CheckCircleIcon className="h-4.5 w-4.5" />
								) : (
									STEP_ICONS[item.id] || (
										<EllipsisHorizontalCircleIcon className="h-4.5 w-4.5" />
									)
								)}
							</div>
							<div className="min-w-0 flex-1 space-y-2">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<div className="text-sm font-medium text-(--desktop-text-primary)">
											{t(item.titleKey)}
										</div>
										<div className="mt-1 text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
											{t(`journey.status.${item.status}`)}
										</div>
									</div>
									{item.action ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant={item.status === 'current' ? 'accent' : 'neutral'}
											onClick={() =>
												onAction(item.action as SiteStudioJourneyAction)
											}
										>
											{t(item.action.labelKey)}
										</DesktopAppButton>
									) : null}
								</div>
								<p className="text-sm leading-6 text-(--desktop-text-secondary)">
									{t(item.descriptionKey)}
								</p>
							</div>
						</DesktopAppSurface>
					</li>
				))}
			</ul>
		</DesktopAppPanel>
	);
};

export default SiteStudioChecklist;
