/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop left guide rail block for composer launchers: agentic auto-accept, web search, attach, tools, phrases, chains.
 *
 * Invariants:
 * - Renders only inside `aside[data-ewa-guide="left-rail"]` on lg+; mobile launchers stay in composer toolbar.
 * - Auto-accept tumbler optional; omitted when `onAutoAcceptTasksChange` is not provided.
 * - Contemplation tumbler optional; omitted when `onContemplationChange` is not provided.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionLeftRailCluster.tsx
 * - src/features/ewa/companionUx/useCompanionChatComposerBundle.tsx
 * - src/features/ewa/companionUx/useCompanionAutoAcceptTasksToggle.ts
 * - src/features/ewa/companionUx/useCompanionContemplationToggle.ts
 */

import {
	BoltIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	PhotoIcon,
	PlusIcon,
	QueueListIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionLeftRailComposerToolsSectionProps = {
	pending: boolean;
	useWebSearch: boolean;
	webSearchLabel: string;
	webSearchTitle: string;
	onWebSearchChange: (checked: boolean) => void;
	/** Agentic mode: skip per-step HITL confirms (file create etc.). */
	autoAcceptTasks?: boolean;
	onAutoAcceptTasksChange?: (checked: boolean) => void;
	autoAcceptPending?: boolean;
	/** Presence: observe without anticipation hint bubbles. */
	contemplationOn?: boolean;
	onContemplationChange?: (checked: boolean) => void;
	contemplationPending?: boolean;
	onAttachImage: () => void;
	onOpenToolsCatalog?: () => void;
	toolsCatalogCount?: number;
	onOpenMyPhrases?: () => void;
	onOpenWorkflowChains?: () => void;
	onCreateWorkflowChain?: () => void;
	onCreateDagWorkflowChain?: () => void;
};

function ComposerToolRowButton({
	pending,
	onClick,
	ariaLabel,
	title,
	testId,
	variant = 'neutral',
	pressed,
	children,
	className,
}: {
	pending: boolean;
	onClick: () => void;
	ariaLabel: string;
	title: string;
	testId?: string;
	variant?: 'neutral' | 'accent';
	pressed?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<DesktopAppButton
			type="button"
			variant={variant}
			size="sm"
			className={cn(
				'flex h-8 w-full min-w-0 items-center justify-start gap-2 px-2 text-left',
				pressed &&
					'ring-1 ring-cyan-400/50 ring-offset-0 ring-offset-transparent',
				className
			)}
			disabled={pending}
			onClick={onClick}
			aria-label={ariaLabel}
			aria-pressed={pressed}
			title={title}
			data-testid={testId}
		>
			{children}
		</DesktopAppButton>
	);
}

export function CompanionLeftRailComposerToolsSection({
	pending,
	useWebSearch,
	webSearchLabel,
	webSearchTitle,
	onWebSearchChange,
	autoAcceptTasks = false,
	onAutoAcceptTasksChange,
	autoAcceptPending = false,
	contemplationOn = false,
	onContemplationChange,
	contemplationPending = false,
	onAttachImage,
	onOpenToolsCatalog,
	toolsCatalogCount = 0,
	onOpenMyPhrases,
	onOpenWorkflowChains,
	onCreateWorkflowChain,
	onCreateDagWorkflowChain,
}: CompanionLeftRailComposerToolsSectionProps) {
	const { t } = useTranslation('marketing');

	const showTools = Boolean(onOpenToolsCatalog);
	const showPhrases = Boolean(onOpenMyPhrases);
	const showAutoAccept = Boolean(onAutoAcceptTasksChange);
	const showContemplation = Boolean(onContemplationChange);

	return (
		<div
			className="flex min-w-0 shrink-0 flex-col"
			data-testid="ewa-companion-left-rail-composer-tools"
			data-ewa-guide="composer-tools"
		>
			<CompanionGlassCard tone="aura" className="overflow-hidden p-2">
				<p className="mb-1.5 px-1 text-[12px] font-semibold text-(--desktop-text-primary)">
					{t('ewaCompanion.composerLauncherRailLabel')}
				</p>
				<fieldset className="flex flex-col gap-1 border-0 p-0 m-0 min-w-0">
					<legend className="sr-only">
						{t('ewaCompanion.composerLauncherRailLabel')}
					</legend>
					{showAutoAccept ? (
						<>
							<ComposerToolRowButton
								pending={pending || autoAcceptPending}
								variant={autoAcceptTasks ? 'accent' : 'neutral'}
								pressed={autoAcceptTasks}
								onClick={() => onAutoAcceptTasksChange?.(!autoAcceptTasks)}
								ariaLabel={t('ewaCompanion.autoAcceptTasksTitle')}
								title={t('ewaCompanion.autoAcceptTasksTitle')}
								testId="ewa-companion-auto-accept-tasks-rail"
							>
								<BoltIcon className="size-4 shrink-0" aria-hidden />
								<span className="min-w-0 truncate text-[12px]">
									{autoAcceptTasks
										? t('ewaCompanion.autoAcceptTasksLabelActive')
										: t('ewaCompanion.autoAcceptTasksLabel')}
								</span>
							</ComposerToolRowButton>
							{autoAcceptTasks ? (
								<p className="px-1 text-[11px] leading-snug text-(--companion-aura)">
									{t('ewaCompanion.autoAcceptTasksHint')}
								</p>
							) : null}
						</>
					) : null}
					{showContemplation ? (
						<>
							<ComposerToolRowButton
								pending={pending || contemplationPending}
								variant={contemplationOn ? 'accent' : 'neutral'}
								pressed={contemplationOn}
								onClick={() => onContemplationChange?.(!contemplationOn)}
								ariaLabel={t('ewaCompanion.contemplationTitle')}
								title={t('ewaCompanion.contemplationTitle')}
								testId="ewa-companion-contemplation-rail"
							>
								<EyeSlashIcon className="size-4 shrink-0" aria-hidden />
								<span className="min-w-0 truncate text-[12px]">
									{contemplationOn
										? t('ewaCompanion.contemplationLabelActive')
										: t('ewaCompanion.contemplationLabel')}
								</span>
							</ComposerToolRowButton>
							{contemplationOn ? (
								<p className="px-1 text-[11px] leading-snug text-(--companion-aura)">
									{t('ewaCompanion.contemplationHint')}
								</p>
							) : null}
						</>
					) : null}
					<ComposerToolRowButton
						pending={pending}
						variant={useWebSearch ? 'accent' : 'neutral'}
						pressed={useWebSearch}
						onClick={() => onWebSearchChange(!useWebSearch)}
						ariaLabel={webSearchTitle || webSearchLabel}
						title={webSearchTitle || webSearchLabel}
						testId="ewa-companion-web-search-rail"
					>
						<GlobeAltIcon className="size-4 shrink-0" aria-hidden />
						<span className="min-w-0 truncate text-[12px]">
							{useWebSearch
								? t('ewaCompanion.webSearchLabelActive')
								: webSearchLabel}
						</span>
					</ComposerToolRowButton>
					{useWebSearch ? (
						<p className="px-1 text-[11px] leading-snug text-(--companion-aura)">
							{t('ewaCompanion.webSearchOneShotHint')}
						</p>
					) : null}
					<ComposerToolRowButton
						pending={pending}
						onClick={onAttachImage}
						ariaLabel={t('ewaCompanion.chatAttachImageAria')}
						title={t('ewaCompanion.chatAttachImage')}
					>
						<PhotoIcon className="size-4 shrink-0" aria-hidden />
						<span className="min-w-0 truncate text-[12px]">
							{t('ewaCompanion.chatAttachImage')}
						</span>
					</ComposerToolRowButton>
					{showTools ? (
						<ComposerToolRowButton
							pending={pending}
							onClick={() => onOpenToolsCatalog?.()}
							ariaLabel={
								toolsCatalogCount > 0
									? t('ewaCompanion.toolsCatalog.openButtonWithCount', {
											count: toolsCatalogCount,
										})
									: t('ewaCompanion.toolsCatalog.openButton')
							}
							title={t('ewaCompanion.toolsCatalog.openButton')}
							testId="ewa-companion-open-tools-catalog"
							className="relative"
						>
							<Squares2X2Icon className="size-4 shrink-0" aria-hidden />
							<span className="min-w-0 flex-1 truncate text-[12px]">
								{t('ewaCompanion.toolsCatalog.openButton')}
							</span>
							{toolsCatalogCount > 0 ? (
								<span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-(--companion-aura)/20 text-[9px] font-semibold text-(--companion-aura)">
									{toolsCatalogCount}
								</span>
							) : null}
						</ComposerToolRowButton>
					) : null}
					{showPhrases ? (
						<ComposerToolRowButton
							pending={pending}
							onClick={() => onOpenMyPhrases?.()}
							ariaLabel={t('ewaCompanion.myPhrases.openButton')}
							title={t('ewaCompanion.myPhrases.openButton')}
							testId="ewa-companion-open-my-phrases"
						>
							<EwaIcon
								name="icon-bookmark"
								size="xs"
								tone="aura"
								className="shrink-0 opacity-90"
							/>
							<span className="min-w-0 truncate text-[12px]">
								{t('ewaCompanion.myPhrases.openButton')}
							</span>
						</ComposerToolRowButton>
					) : null}
					{onOpenWorkflowChains ? (
						<div className="flex min-w-0 flex-col gap-0.5">
							<ComposerToolRowButton
								pending={pending}
								onClick={onOpenWorkflowChains}
								ariaLabel={t('ewaCompanion.userWorkflowChainsLabel')}
								title={t('ewaCompanion.userWorkflowChainsLabel')}
								testId="ewa-companion-open-workflow-chains"
							>
								<QueueListIcon className="size-4 shrink-0" aria-hidden />
								<span className="min-w-0 truncate text-[12px]">
									{t('ewaCompanion.userWorkflowChainsLabel')}
								</span>
							</ComposerToolRowButton>
							<p className="px-1 text-[10px] leading-snug text-(--companion-text-soft)">
								{t(
									'ewaCompanion.userWorkflowAdvancedDeskHint',
									'Advanced desk pipelines open separately when needed — everyday chains stay here.'
								)}
							</p>
						</div>
					) : null}
					{onCreateWorkflowChain ? (
						<ComposerToolRowButton
							pending={pending}
							onClick={onCreateWorkflowChain}
							ariaLabel={t('ewaCompanion.userWorkflowQuickNew')}
							title={t('ewaCompanion.userWorkflowQuickNew')}
							testId="ewa-companion-create-workflow-chain"
							className="border-dashed"
						>
							<PlusIcon className="size-4 shrink-0" aria-hidden />
							<span className="min-w-0 truncate text-[12px]">
								{t('ewaCompanion.userWorkflowQuickNew')}
							</span>
						</ComposerToolRowButton>
					) : null}
					{onCreateDagWorkflowChain ? (
						<ComposerToolRowButton
							pending={pending}
							onClick={onCreateDagWorkflowChain}
							ariaLabel={t('ewaCompanion.userWorkflowQuickNewVisual')}
							title={t('ewaCompanion.userWorkflowQuickNewVisual')}
							testId="ewa-companion-create-dag-workflow-chain"
							className="border-dashed"
						>
							<Squares2X2Icon className="size-4 shrink-0" aria-hidden />
							<span className="min-w-0 truncate text-[12px]">
								{t('ewaCompanion.userWorkflowQuickNewVisual')}
							</span>
						</ComposerToolRowButton>
					) : null}
				</fieldset>
			</CompanionGlassCard>
		</div>
	);
}
