/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact Site Studio workspace header: site identity, runtime badges, journey
 * stage strip (single progress owner), and secondary tools (assistant / manage).
 *
 * Invariants:
 * - Primary nav is journey steps, not peer tabs.
 * - Header actions stay shallow: refresh and stage/tool selection; runtime side effects remain in journey/runtime panels.
 *
 * Related:
 * - `features/site-studio/desktop/UserSiteStudioApp.tsx`
 * - `features/site-studio/desktop/siteStudioUserJourney.ts`
 * - `documentation/product/SITE-STUDIO-UI-PERFECTION-PLAN-2026-07.md`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import type { SiteStudioHealth, SiteStudioInstance } from '../api';
import {
	ArrowPathIcon,
	CpuChipIcon,
	GlobeAltIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import type {
	SiteStudioJourneyModel,
	SiteStudioJourneyStepId,
} from '../siteStudioUserJourney';

export interface SiteStudioWorkspaceTabItem {
	id: string;
	label: string;
	disabled?: boolean;
}

interface SiteStudioHeaderProps {
	instance: SiteStudioInstance;
	health: SiteStudioHealth | null;
	activeTab: string;
	/** Secondary tools only (assistant, manage). */
	toolTabs: SiteStudioWorkspaceTabItem[];
	journey?: SiteStudioJourneyModel | null;
	refreshing?: boolean;
	onRefresh: () => void;
	onSelectTab: (tabId: string) => void;
	onSelectJourneyStep: (stepId: SiteStudioJourneyStepId) => void;
}

function getRuntimeTone(status: string): string {
	if (status === 'running')
		return 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)';
	if (status === 'failed')
		return 'border-red-500/35 bg-red-500/10 text-(--desktop-text-primary)';
	if (status === 'stopped')
		return 'border-amber-500/35 bg-amber-500/10 text-(--desktop-text-primary)';
	return 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)';
}

function getPublicationTone(publicationState: string): string {
	return publicationState === 'open'
		? 'border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent)/50 text-(--desktop-text-primary)'
		: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)';
}

function stepTone(status: string, active: boolean): string {
	if (active) return '';
	if (status === 'done') return 'opacity-80';
	if (status === 'blocked') return 'border-amber-400/35';
	return '';
}

export const SiteStudioHeader: React.FC<SiteStudioHeaderProps> = ({
	instance,
	health,
	activeTab,
	toolTabs,
	journey,
	refreshing,
	onRefresh,
	onSelectTab,
	onSelectJourneyStep,
}) => {
	const { t } = useTranslation('siteStudio');
	const shellFrame = useDesktopShellFrame();
	const tabCluster = getDesktopShellToolbarClusterClassName(shellFrame);
	const runtimeStatus =
		health?.status === 'running' ? 'running' : instance.status;
	const topicFallback = t('header.topicFallback');
	const topicText = instance.site_topic || topicFallback;
	const journeyTitle = journey ? t(journey.titleKey) : null;
	const journeyDescription = journey
		? journey.blockerKey
			? t(journey.blockerKey)
			: t(journey.descriptionKey)
		: null;
	const currentStepId =
		journey?.steps.find((step) => step.status === 'current')?.id ??
		journey?.steps.find((step) => step.status === 'blocked')?.id ??
		null;

	return (
		<header
			className={cn(
				'shrink-0 pb-1',
				getDesktopShellHeaderStripClassName(shellFrame)
			)}
			data-ss-guide="header"
		>
			<div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
				<div className="flex min-w-0 flex-[1_1_12rem] flex-wrap items-center gap-x-1.5 gap-y-0.5">
					<DesktopAppSectionLabel className="shrink-0 text-[10px]! tracking-[0.14em]!">
						{t('header.productLabel')}
					</DesktopAppSectionLabel>
					<h1
						className="min-w-0 max-w-[min(100%,14rem)] truncate text-sm font-semibold leading-none text-(--desktop-text-primary) sm:max-w-[18rem]"
						title={instance.site_title}
					>
						{instance.site_title}
					</h1>
					<span
						className="hidden shrink-0 text-[10px] text-(--desktop-text-dim) sm:inline"
						aria-hidden
					>
						·
					</span>
					<p
						className="min-w-0 max-w-full flex-[1_1_8rem] text-[10px] leading-tight text-(--desktop-text-secondary) line-clamp-1 sm:max-w-[min(100%,24rem)]"
						title={topicText}
					>
						{topicText}
					</p>
				</div>
				<div className="flex min-w-0 flex-wrap content-center gap-0.5">
					<DesktopAppStatusBadge
						className={cn(
							getRuntimeTone(runtimeStatus),
							'px-1 py-0 text-[8px] leading-tight'
						)}
					>
						{t('header.runtimeBadge', { status: runtimeStatus })}
					</DesktopAppStatusBadge>
					<DesktopAppStatusBadge
						className={cn(
							getPublicationTone(instance.publication_state),
							'px-1 py-0 text-[8px] leading-tight'
						)}
					>
						{t('header.siteBadge', {
							state:
								instance.publication_state === 'open'
									? t('header.siteOpen')
									: t('header.siteClosed'),
						})}
					</DesktopAppStatusBadge>
					{journey ? (
						<DesktopAppStatusBadge
							className="border-[rgb(var(--desktop-accent-rgb))]/30 bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-1 py-0 text-[8px] leading-tight text-(--desktop-text-primary)"
							title={journeyDescription ?? undefined}
						>
							<SparklesIcon
								className="mr-0.5 h-2.5 w-2.5 shrink-0"
								aria-hidden
							/>
							{t('header.routeBadge', {
								done: journey.progressDone,
								total: journey.progressTotal,
							})}
						</DesktopAppStatusBadge>
					) : null}
					{journeyTitle ? (
						<DesktopAppStatusBadge
							className="max-w-44 border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1 py-0 text-[8px] leading-tight text-(--desktop-text-secondary)"
							title={journeyDescription ?? journeyTitle}
						>
							<span className="truncate">
								{t('header.nextBadge', { stage: journeyTitle })}
							</span>
						</DesktopAppStatusBadge>
					) : null}
					<DesktopAppStatusBadge
						className={cn(
							health?.api_ok
								? 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
								: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)',
							'px-1 py-0 text-[8px] leading-tight'
						)}
					>
						{t('header.apiBadge', {
							state: health?.api_ok
								? t('header.stateOk')
								: t('header.stateOffline'),
						})}
					</DesktopAppStatusBadge>
					<DesktopAppStatusBadge
						className={cn(
							health?.public_ok
								? 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
								: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)',
							'px-1 py-0 text-[8px] leading-tight'
						)}
					>
						<GlobeAltIcon className="mr-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
						{t('header.publicBadge', {
							state: health?.public_ok
								? t('header.stateOk')
								: t('header.stateOffline'),
						})}
					</DesktopAppStatusBadge>
				</div>
				<DesktopAppButton
					type="button"
					size="icon"
					variant="ghost"
					className="h-7! w-7! shrink-0"
					onClick={onRefresh}
					disabled={refreshing}
					aria-label={t('header.refreshAria')}
					title={t('header.refreshAria')}
				>
					<ArrowPathIcon
						className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
						aria-hidden
					/>
				</DesktopAppButton>
			</div>

			{journey ? (
				<nav
					className={cn(
						'-mx-0.5 mt-0.5 flex gap-0.5 overflow-x-auto overflow-y-hidden p-1.5 pb-1.5 scrollbar-thin rounded-(--desktop-radius-lg)',
						tabCluster
					)}
					aria-label={t('header.navAria')}
					data-ss-guide="tabs"
					data-testid="site-studio-stage-nav"
				>
					{journey.steps.map((step) => {
						const active = step.id === currentStepId;
						return (
							<DesktopAppButton
								key={step.id}
								type="button"
								size="sm"
								variant={active ? 'accent' : 'neutral'}
								className={cn(
									'h-6 shrink-0 gap-1 whitespace-nowrap px-1.5 py-0 text-[10px] leading-none',
									stepTone(step.status, active)
								)}
								onClick={() => onSelectJourneyStep(step.id)}
								aria-current={active ? 'step' : undefined}
							>
								{t(step.titleKey)}
							</DesktopAppButton>
						);
					})}
				</nav>
			) : null}

			<nav
				className={cn(
					'-mx-0.5 mt-0.5 flex gap-0.5 overflow-x-auto overflow-y-hidden p-1 pb-1 scrollbar-thin'
				)}
				aria-label={t('header.toolsNavAria')}
				data-testid="site-studio-tools-nav"
			>
				{toolTabs.map((tab) => (
					<DesktopAppButton
						key={tab.id}
						type="button"
						size="sm"
						variant={activeTab === tab.id ? 'accent' : 'ghost'}
						className="h-6 shrink-0 gap-1 whitespace-nowrap px-1.5 py-0 text-[10px] leading-none"
						onClick={() => onSelectTab(tab.id)}
						disabled={tab.disabled}
						aria-current={activeTab === tab.id ? 'page' : undefined}
					>
						{tab.id === 'ai' ? (
							<CpuChipIcon className="h-3 w-3 shrink-0" aria-hidden />
						) : (
							<ShieldCheckIcon className="h-3 w-3 shrink-0" aria-hidden />
						)}
						{tab.label}
					</DesktopAppButton>
				))}
			</nav>
		</header>
	);
};

export default SiteStudioHeader;
