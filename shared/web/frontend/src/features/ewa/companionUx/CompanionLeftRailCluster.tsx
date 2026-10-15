/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop left aside and mobile meta rail: anticipation, server actions, protocol strips, turn plan, memory, plan, composer tools (U8.3 slice 21).
 *
 * Invariants:
 * - Desktop aside includes protocol strips; mobile meta rail omits them and embeds operations rail in a grid with memory.
 * - Protocol strips + turn plan stay behind progressive disclosure (collapsed by default) so presence / tools / memory / plan stay primary.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	CompanionAnticipationHintSection,
	type CompanionAnticipationHintSectionProps,
} from '@/features/ewa/companionUx/CompanionAnticipationHintSection';
import {
	CompanionChatOperationsRail,
	type CompanionChatOperationsRailProps,
} from '@/features/ewa/companionUx/CompanionChatOperationsRail';
import {
	CompanionLeftRailMemorySection,
	type CompanionLeftRailMemorySectionProps,
} from '@/features/ewa/companionUx/CompanionLeftRailMemorySection';
import {
	CompanionLeftRailPlanSection,
	type CompanionLeftRailPlanSectionProps,
} from '@/features/ewa/companionUx/CompanionLeftRailPlanSection';
import {
	CompanionLeftRailServerActionsSection,
	type CompanionLeftRailServerActionsSectionProps,
} from '@/features/ewa/companionUx/CompanionLeftRailServerActionsSection';
import {
	CompanionProtocolStrips,
	type CompanionProtocolStripsProps,
} from '@/features/ewa/companionUx/CompanionProtocolStrips';
import {
	CompanionTurnPlanStrip,
	type CompanionTurnPlanStripProps,
} from '@/features/ewa/companionUx/CompanionTurnPlanStrip';
import {
	CompanionLeftRailComposerToolsSection,
	type CompanionLeftRailComposerToolsSectionProps,
} from '@/features/ewa/companionUx/CompanionLeftRailComposerToolsSection';
import {
	CompanionPresenceCompactBar,
	type CompanionPresenceCompactBarProps,
} from '@/features/ewa/companionUx/CompanionPresenceCompactBar';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionLeftRailClusterProps = {
	anticipationProps: CompanionAnticipationHintSectionProps;
	serverActionsProps: CompanionLeftRailServerActionsSectionProps;
	protocolStripsProps: CompanionProtocolStripsProps;
	turnPlanProps: CompanionTurnPlanStripProps;
	planSectionProps: CompanionLeftRailPlanSectionProps;
	memorySectionProps: CompanionLeftRailMemorySectionProps;
	composerToolsProps?: CompanionLeftRailComposerToolsSectionProps;
};

type CompanionLeftRailClusterContentProps = CompanionLeftRailClusterProps & {
	layout: 'desktop' | 'mobile-meta';
	operationsRailProps?: CompanionChatOperationsRailProps;
	hideMemoryStrip?: boolean;
};

function CompanionLeftRailActivityDisclosure({
	protocolStripsProps,
	turnPlanProps,
}: {
	protocolStripsProps: CompanionProtocolStripsProps;
	turnPlanProps: CompanionTurnPlanStripProps;
}) {
	const { t } = useTranslation('marketing');
	const [open, setOpen] = useState(false);

	return (
		<div
			className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
			data-testid="ewa-companion-left-rail-activity"
		>
			<button
				type="button"
				className={cn(
					'flex w-full items-center gap-2 px-2.5 py-2 text-left',
					EWA_COMPANION_TYPOGRAPHY.meta,
					'font-semibold text-(--desktop-text-secondary) hover:bg-white/5',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				aria-expanded={open}
				data-testid="ewa-companion-left-rail-activity-toggle"
				onClick={() => setOpen((value) => !value)}
			>
				<ChevronDownIcon
					className={cn(
						'size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
						open && 'rotate-180'
					)}
					aria-hidden
				/>
				<span className="min-w-0 flex-1 truncate">
					{open
						? t('ewaCompanion.leftRailHideActivity', 'Hide activity details')
						: t('ewaCompanion.leftRailShowActivity', 'Activity details')}
				</span>
			</button>
			{open ? (
				<div
					className="flex flex-col gap-2 border-t border-white/8 px-1.5 pb-2 pt-2"
					data-testid="ewa-companion-left-rail-activity-body"
				>
					<CompanionProtocolStrips {...protocolStripsProps} />
					<CompanionTurnPlanStrip {...turnPlanProps} />
				</div>
			) : null}
		</div>
	);
}

function CompanionLeftRailClusterContent({
	layout,
	compactPresenceProps,
	anticipationProps,
	serverActionsProps,
	protocolStripsProps,
	turnPlanProps,
	planSectionProps,
	memorySectionProps,
	composerToolsProps,
	operationsRailProps,
	hideMemoryStrip = false,
}: CompanionLeftRailClusterContentProps & {
	compactPresenceProps?: CompanionPresenceCompactBarProps;
}) {
	if (layout === 'desktop') {
		return (
			<div
				className="flex min-h-0 min-w-0 flex-col gap-2 *:shrink-0"
				data-testid="ewa-companion-left-rail-stack"
			>
				{compactPresenceProps ? (
					<CompanionPresenceCompactBar {...compactPresenceProps} />
				) : null}
				<CompanionAnticipationHintSection {...anticipationProps} />
				<CompanionLeftRailServerActionsSection {...serverActionsProps} />
				<CompanionLeftRailActivityDisclosure
					protocolStripsProps={protocolStripsProps}
					turnPlanProps={turnPlanProps}
				/>
				<CompanionLeftRailMemorySection {...memorySectionProps} />
				<CompanionLeftRailPlanSection {...planSectionProps} />
				{composerToolsProps ? (
					<CompanionLeftRailComposerToolsSection {...composerToolsProps} />
				) : null}
			</div>
		);
	}

	return (
		<>
			<CompanionAnticipationHintSection {...anticipationProps} />
			<CompanionLeftRailServerActionsSection {...serverActionsProps} />
			<CompanionTurnPlanStrip {...turnPlanProps} />
			<CompanionLeftRailPlanSection {...planSectionProps} />
			<div
				className={cn(
					'grid min-h-0 min-w-0 shrink-0 gap-2',
					hideMemoryStrip ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
				)}
			>
				<CompanionLeftRailMemorySection {...memorySectionProps} />
				{operationsRailProps ? (
					<div
						className="flex min-h-0 min-w-0 flex-col"
						data-ewa-guide="operations"
					>
						<CompanionChatOperationsRail
							{...operationsRailProps}
							secondaryRailMode
						/>
					</div>
				) : null}
			</div>
		</>
	);
}

export type CompanionDesktopLeftRailAsideProps =
	CompanionLeftRailClusterProps & {
		compactPresenceProps: CompanionPresenceCompactBarProps;
	};

export function CompanionDesktopLeftRailAside({
	compactPresenceProps,
	...props
}: CompanionDesktopLeftRailAsideProps) {
	return (
		<aside
			data-ewa-guide="left-rail"
			className={cn(
				'hidden min-h-0 w-[min(17.5rem,27vw)] shrink-0 flex-col overflow-y-auto overscroll-y-contain',
				'lg:flex lg:border-r lg:border-(--companion-divider) lg:pr-2'
			)}
		>
			<CompanionLeftRailClusterContent
				layout="desktop"
				compactPresenceProps={compactPresenceProps}
				{...props}
			/>
		</aside>
	);
}

export type CompanionMobileMetaRailProps = CompanionLeftRailClusterProps & {
	hideMemoryStrip: boolean;
	operationsRailProps: CompanionChatOperationsRailProps;
};

export function CompanionMobileMetaRail({
	hideMemoryStrip,
	operationsRailProps,
	...clusterProps
}: CompanionMobileMetaRailProps) {
	return (
		<div
			className="flex max-h-[min(38vh,16rem)] flex-col gap-2 overflow-y-auto overscroll-y-contain lg:hidden"
			data-ewa-guide="left-rail"
			data-companion-mobile-meta="1"
		>
			<CompanionLeftRailClusterContent
				layout="mobile-meta"
				hideMemoryStrip={hideMemoryStrip}
				operationsRailProps={operationsRailProps}
				{...clusterProps}
			/>
		</div>
	);
}
