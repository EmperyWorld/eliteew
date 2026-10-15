/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Idle-chat Master Dashboard (Gateway): capability cards for Agentic, Media, Workflows, Documents.
 *
 * Invariants:
 * - Presentation/navigation only — each CTA calls a real surface opener or starter prompt (no placeholders).
 * - Shown when transcript is empty and center mission is absent.
 * - One primary capability (Agentic); secondary cards stay outline; examples are progressive disclosure.
 *
 * Related:
 * - documentation/product/ewa/EWA-UNIFIED-WORKSPACE-JOURNEY-2026-07-09.md
 * - CompanionTranscriptEmptyState.tsx
 * - companionPremiumPrimitives.tsx
 */

import {
	ChevronDownIcon,
	DocumentTextIcon,
	PhotoIcon,
	SparklesIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	CompanionHeroCard,
	CompanionIconTile,
} from '@/features/ewa/companionPremiumPrimitives';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionMasterDashboardProps = {
	displayName: string;
	onStartAgentic: () => void;
	onCreateMedia: () => void;
	onManageWorkflows: () => void;
	onAccessDocuments: () => void;
	onOpenTools: () => void;
	onChooseMissionPrompt?: (prompt: string) => void;
	/** Single-column compact gateway for mobile embedded WebView. */
	embeddedMobile?: boolean;
};

type CapabilityCard = {
	id: string;
	title: string;
	body: string;
	destinationMeta: string;
	icon: typeof SparklesIcon;
	onClick: () => void;
	primary?: boolean;
};

type MissionExample = {
	id: string;
	promptKey: string;
};

const MISSION_EXAMPLES: readonly MissionExample[] = [
	{
		id: 'research',
		promptKey: 'ewaCompanion.chatEmptyMissionExampleResearch',
	},
	{
		id: 'campaign',
		promptKey: 'ewaCompanion.chatEmptyMissionExampleCampaign',
	},
	{
		id: 'media',
		promptKey: 'ewaCompanion.chatEmptyMissionExampleMedia',
	},
] as const;

const GATEWAY_CARD_MOTION =
	'transition-[background-color,border-color,box-shadow,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none';

export function CompanionMasterDashboard({
	displayName,
	onStartAgentic,
	onCreateMedia,
	onManageWorkflows,
	onAccessDocuments,
	onOpenTools,
	onChooseMissionPrompt,
	embeddedMobile = false,
}: CompanionMasterDashboardProps) {
	const { t } = useTranslation('marketing');
	const [examplesOpen, setExamplesOpen] = useState(false);

	const cards: CapabilityCard[] = [
		{
			id: 'agentic',
			title: t('ewaCompanion.gatewayCardAgenticTitle', 'Start an agentic task'),
			body: t(
				'ewaCompanion.gatewayCardAgenticBody',
				'Describe a multi-step goal — the companion plans, asks when needed, and shows progress in the center.'
			),
			destinationMeta: t('ewaCompanion.gatewayCardMetaChat', 'Starts in chat'),
			icon: SparklesIcon,
			onClick: onStartAgentic,
			primary: true,
		},
		{
			id: 'media',
			title: t('ewaCompanion.gatewayCardMediaTitle', 'Create media'),
			body: t(
				'ewaCompanion.gatewayCardMediaBody',
				'Image, music, or presentation — results stay in this workspace; open the full desk app only when you need it.'
			),
			destinationMeta: t('ewaCompanion.gatewayCardMetaTools', 'Opens tools'),
			icon: PhotoIcon,
			onClick: onCreateMedia,
		},
		{
			id: 'workflows',
			title: t('ewaCompanion.gatewayCardWorkflowsTitle', 'Manage workflows'),
			body: t(
				'ewaCompanion.gatewayCardWorkflowsBody',
				'Open your chains and builders here. Advanced desk pipelines stay optional.'
			),
			destinationMeta: t(
				'ewaCompanion.gatewayCardMetaWorkspace',
				'Opens workspace'
			),
			icon: Squares2X2Icon,
			onClick: onManageWorkflows,
		},
		{
			id: 'documents',
			title: t('ewaCompanion.gatewayCardDocumentsTitle', 'Access documents'),
			body: t(
				'ewaCompanion.gatewayCardDocumentsBody',
				'Browse and edit in the companion window without leaving the chat workspace.'
			),
			destinationMeta: t('ewaCompanion.gatewayCardMetaChat', 'Starts in chat'),
			icon: DocumentTextIcon,
			onClick: onAccessDocuments,
		},
	];

	const visibleCards = embeddedMobile
		? cards.filter((card) => card.primary || card.id === 'media')
		: cards;

	return (
		<CompanionHeroCard
			className={cn(
				'mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5',
				embeddedMobile && 'max-w-none gap-3 px-2 py-3',
				'text-(--companion-text-soft)',
				'opacity-100 transition-opacity duration-200 motion-reduce:transition-none'
			)}
			data-testid="ewa-companion-master-dashboard"
			data-embedded-mobile={embeddedMobile ? '1' : undefined}
		>
			<div className={cn('text-center', embeddedMobile && 'text-left')}>
				<span
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.overline,
						'rounded-full border border-(--companion-divider) bg-(--companion-bg) px-3 py-1 font-semibold tracking-[0.18em] text-(--companion-aura)'
					)}
				>
					{displayName}
				</span>
				<p
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.hero,
						'mt-3',
						embeddedMobile && 'text-xl leading-snug'
					)}
				>
					{t('ewaCompanion.gatewayTitle', 'Unified intelligence workspace')}
				</p>
				<p
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.meta,
						'mx-auto mt-1.5 max-w-md text-(--desktop-text-secondary)',
						embeddedMobile && 'mx-0 max-w-none'
					)}
				>
					{t(
						'ewaCompanion.gatewayHint',
						'Pick a capability or describe a mission — chat stays the orchestrator for documents, media, and workflows.'
					)}
				</p>
			</div>

			<div
				className={cn(
					'grid gap-2.5',
					embeddedMobile ? 'grid-cols-1' : 'sm:grid-cols-2'
				)}
			>
				{visibleCards.map((card) => {
					const Icon = card.icon;
					return (
						<button
							type="button"
							key={card.id}
							data-testid={`ewa-gateway-card-${card.id}`}
							className={cn(
								'group flex flex-col items-start gap-2 rounded-xl border px-3.5 py-3.5 text-left',
								GATEWAY_CARD_MOTION,
								card.primary
									? 'border-(--companion-aura)/45 bg-(--companion-aura)/10 hover:-translate-y-px'
									: 'border-white/10 bg-white/4 hover:border-(--companion-aura)/35 hover:bg-(--companion-aura)/8 hover:-translate-y-px',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={card.onClick}
						>
							<span className="flex w-full items-start gap-2.5">
								<CompanionIconTile className="rounded-xl p-2">
									<Icon className="size-4 shrink-0" aria-hidden />
								</CompanionIconTile>
								<span className="min-w-0 flex-1">
									<span
										className={cn(
											EWA_COMPANION_TYPOGRAPHY.label,
											'block leading-snug'
										)}
									>
										{card.title}
									</span>
									<span
										className={cn(
											EWA_COMPANION_TYPOGRAPHY.micro,
											'mt-0.5 block text-(--companion-aura)/90'
										)}
									>
										{card.destinationMeta}
									</span>
								</span>
							</span>
							{!embeddedMobile || card.primary ? (
								<span
									className={cn(
										EWA_COMPANION_TYPOGRAPHY.meta,
										'line-clamp-3 leading-snug text-(--desktop-text-secondary)',
										embeddedMobile && 'line-clamp-2'
									)}
								>
									{card.body}
								</span>
							) : null}
						</button>
					);
				})}
			</div>

			<div className="flex flex-col gap-2">
				<button
					type="button"
					className={cn(
						'inline-flex items-center justify-center gap-1 self-center',
						EWA_COMPANION_TYPOGRAPHY.meta,
						'text-(--desktop-text-secondary) hover:text-(--companion-aura)',
						GATEWAY_CARD_MOTION,
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					aria-expanded={examplesOpen}
					data-testid="ewa-gateway-examples-toggle"
					onClick={() => setExamplesOpen((open) => !open)}
				>
					{t('ewaCompanion.gatewayExamplesLabel', 'Try an example')}
					<ChevronDownIcon
						className={cn(
							'size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
							examplesOpen && 'rotate-180'
						)}
						aria-hidden
					/>
				</button>
				{examplesOpen ? (
					<div
						className={cn(
							'grid gap-1.5 text-left',
							embeddedMobile ? 'grid-cols-1' : 'sm:grid-cols-3'
						)}
						data-testid="ewa-gateway-examples"
					>
						{MISSION_EXAMPLES.map((example) => {
							const label = t(example.promptKey);
							return (
								<button
									type="button"
									key={example.id}
									title={label}
									className={cn(
										'rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-left',
										EWA_COMPANION_TYPOGRAPHY.meta,
										'line-clamp-2 leading-snug text-(--desktop-text-secondary)',
										'hover:border-(--companion-aura)/45 hover:bg-(--companion-aura)/8',
										GATEWAY_CARD_MOTION,
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
									onClick={() => onChooseMissionPrompt?.(label)}
								>
									{label}
								</button>
							);
						})}
					</div>
				) : null}
			</div>

			<div className="flex justify-center">
				<button
					type="button"
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.meta,
						'text-(--desktop-text-secondary) hover:text-(--companion-aura)',
						GATEWAY_CARD_MOTION,
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					onClick={onOpenTools}
					data-testid="ewa-gateway-show-tools"
				>
					{t('ewaCompanion.chatEmptyShowTools')}
				</button>
			</div>
		</CompanionHeroCard>
	);
}
