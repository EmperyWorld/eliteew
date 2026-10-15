/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile / narrow companion presence header: horizontal sigil + name (desktop lg+ uses `CompanionPresenceCompactBar` in left rail).
 *
 * Invariants:
 * - Shown only when `mobileEmbeddedLayout` or below `lg` breakpoint (via `CompanionChatMainRow`).
 * - Operations entry appears when `showOperationsEntry` (no right rail) — opens the shared ops sheet.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionPresenceCompactBar.tsx
 * - src/features/ewa/companionUx/companionPresenceDisplayTypes.ts
 * - src/features/ewa/companionUx/CompanionNonChatOperationsEntry.tsx
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import {
	MOBILE_EMBEDDED_EWA_LANDSCAPE_HEADER_CLASS,
	MOBILE_EMBEDDED_EWA_PRESENCE_HEADER_CLASS,
	MOBILE_EMBEDDED_EWA_ROLE_LINE_CLASS,
	MOBILE_EMBEDDED_EWA_SIGIL_CLASS,
} from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import type { CompanionPresenceHeaderProps } from '@/features/ewa/companionUx/companionPresenceDisplayTypes';
import { CompanionPresenceSigilControl } from '@/features/ewa/companionUx/CompanionPresenceSigilControl';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

export type { CompanionPresenceHeaderProps } from '@/features/ewa/companionUx/companionPresenceDisplayTypes';

export function CompanionPresenceHeader({
	mobileEmbeddedLayout,
	mobileEmbeddedLandscape,
	personaId,
	presence,
	bond,
	streamPhase,
	displayName,
	presenceChipLabel,
	roleLine,
	canToggleArlikaV2Sigil,
	arlikaV2SigilLabel,
	arlikaV2ModeSwitching,
	pending,
	onArlikaV2SigilToggle,
	showOperationsEntry = false,
	activeOperationCount = 0,
	awaitingConfirmationCount = 0,
	onOpenOperations,
}: CompanionPresenceHeaderProps) {
	const { t } = useTranslation('marketing');
	const bondArcHint = t('ewaCompanion.bondArcHint');
	const needsDecision = awaitingConfirmationCount > 0;
	const visibleOpsCount = needsDecision
		? awaitingConfirmationCount
		: activeOperationCount;

	return (
		<div
			className={cn(
				mobileEmbeddedLayout
					? MOBILE_EMBEDDED_EWA_PRESENCE_HEADER_CLASS
					: 'relative flex shrink-0 flex-row items-center gap-2 rounded-2xl border border-(--companion-divider) bg-[radial-gradient(circle_at_12%_0%,var(--companion-glow),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.16))] px-3 py-2 shadow-[0_18px_44px_rgba(2,6,23,0.16)] lg:hidden',
				mobileEmbeddedLandscape && MOBILE_EMBEDDED_EWA_LANDSCAPE_HEADER_CLASS
			)}
			data-ewa-guide="presence-header"
			data-testid="ewa-companion-presence-header"
		>
			<CompanionPresenceSigilControl
				personaId={personaId}
				presence={presence}
				bond={bond}
				streamPhase={streamPhase}
				canToggle={canToggleArlikaV2Sigil}
				toggleLabel={arlikaV2SigilLabel}
				toggleBusy={arlikaV2ModeSwitching}
				pending={pending}
				onToggle={onArlikaV2SigilToggle}
				sigilSize={mobileEmbeddedLayout ? 'compact' : 'default'}
				sigilClassName={
					mobileEmbeddedLayout ? MOBILE_EMBEDDED_EWA_SIGIL_CLASS : undefined
				}
				bondArcHint={bondArcHint}
			/>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.label,
							'truncate tracking-wide'
						)}
					>
						{displayName}
					</p>
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.micro,
							'shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-1.5 py-0.5 font-medium italic text-(--companion-text-soft)'
						)}
					>
						{presenceChipLabel}
					</p>
				</div>
				<p
					className={cn(
						mobileEmbeddedLayout
							? MOBILE_EMBEDDED_EWA_ROLE_LINE_CLASS
							: cn(
									EWA_COMPANION_TYPOGRAPHY.bodyCompact,
									'truncate font-medium leading-snug text-(--desktop-text-secondary)'
								)
					)}
				>
					{roleLine}
				</p>
			</div>
			{showOperationsEntry && onOpenOperations ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className={cn(
						'relative shrink-0 gap-1',
						visibleOpsCount > 0 &&
							'border-[rgb(var(--desktop-accent-rgb)/0.4)]',
						needsDecision && 'border-amber-300/45 text-amber-50'
					)}
					disabled={pending}
					onClick={onOpenOperations}
					aria-label={
						needsDecision
							? t('ewaCompanion.nonChatOperationsDecisionAria', {
									count: awaitingConfirmationCount,
								})
							: activeOperationCount > 0
								? t('ewaCompanion.nonChatOperationsEntryAria', {
										count: activeOperationCount,
									})
								: t('ewaCompanion.operationsSheetTitle')
					}
					title={t('ewaCompanion.operationsSheetTitle')}
					data-testid="ewa-companion-presence-operations-open"
					data-active-operations={
						visibleOpsCount > 0 ? String(visibleOpsCount) : undefined
					}
				>
					<SparklesIcon className="size-3.5" aria-hidden />
					<span className="hidden text-[11px] min-[420px]:inline">
						{needsDecision
							? t('ewaCompanion.nonChatOperationsDecisionEntry')
							: t('ewaCompanion.nonChatOperationsEntry')}
					</span>
					{visibleOpsCount > 0 ? (
						<span
							className={cn(
								'flex h-4 min-w-4 items-center justify-center rounded-full px-1',
								'text-[9px] font-bold leading-none text-white',
								needsDecision
									? 'bg-amber-400 text-[rgb(var(--desktop-bg-primary-rgb))]'
									: 'bg-[rgb(var(--desktop-accent-rgb))]'
							)}
							aria-hidden
						>
							{visibleOpsCount > 9 ? '9+' : visibleOpsCount}
						</span>
					) : null}
				</DesktopAppButton>
			) : null}
		</div>
	);
}
