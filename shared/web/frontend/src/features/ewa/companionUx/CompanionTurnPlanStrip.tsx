/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * «Следующий шаг» strip for deferred companion turn-plan queue (U8.3 slice 9).
 *
 * Invariants:
 * - Parent owns ``turnPlanVisual`` from left-rail controller; continue action is delegated via callback.
 *
 * Related:
 * - src/features/ewa/companionTurnPlanUi.ts
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 */

import { useTranslation } from 'react-i18next';

import {
	resolveTurnPlanToolLabel,
	turnPlanPrimaryActionKey,
} from '@/features/ewa/companionTurnPlanUi';
import type { CompanionTurnPlanVisual } from '@/features/ewa/companionUx/useCompanionLeftRailController';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionTurnPlanStripProps = {
	turnPlanVisual: CompanionTurnPlanVisual | null;
	pending: boolean;
	onContinue: () => void;
};

export function CompanionTurnPlanStrip({
	turnPlanVisual,
	pending,
	onContinue,
}: CompanionTurnPlanStripProps) {
	const { t } = useTranslation('marketing');

	if (!turnPlanVisual) return null;

	return (
		<CompanionGlassCard
			data-testid="ewa-companion-turn-plan-strip"
			className="shrink-0 px-3 py-2"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-primary)">
						{t('ewaCompanion.turnPlanStripTitle')}
					</p>
					<p className="text-[12px] font-medium text-(--desktop-text-secondary)">
						{turnPlanVisual.nextTool
							? t(
									turnPlanVisual.queued
										? 'ewaCompanion.turnPlanQueuedStatus'
										: 'ewaCompanion.turnPlanNoticeStatus',
									{
										tool: resolveTurnPlanToolLabel(t, turnPlanVisual.nextTool),
									}
								)
							: t('ewaCompanion.turnPlanNoticeStatusGeneric')}
					</p>
				</div>
				<span
					className={cn(
						'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
						turnPlanVisual.queued
							? 'border-(--companion-divider) text-(--companion-aura)'
							: 'border-amber-300/45 text-amber-100'
					)}
				>
					{turnPlanVisual.queued
						? t('ewaCompanion.turnPlanBadgeQueued')
						: t('ewaCompanion.turnPlanBadgeNotice')}
				</span>
			</div>
			{turnPlanVisual.hint ? (
				<p className="mt-1 whitespace-pre-line text-[11px] leading-snug text-(--companion-text-soft)">
					{turnPlanVisual.hint}
				</p>
			) : null}
			{turnPlanVisual.queued ? (
				<div className="mt-2 flex justify-end">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="shrink-0"
						disabled={pending}
						onClick={onContinue}
						aria-label={t('ewaCompanion.turnPlanQueueContinueAria')}
					>
						{t(turnPlanPrimaryActionKey(turnPlanVisual.nextTool))}
					</DesktopAppButton>
				</div>
			) : null}
		</CompanionGlassCard>
	);
}
