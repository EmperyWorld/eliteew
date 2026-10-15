/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render server `surface_blocks[0]` kind badge and non-duplicate block actions (U4.9).
 *
 * Invariants:
 * - Does not replace ConfirmBar; skips duplicate `task_run_confirm` actions.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 */

import { useTranslation } from 'react-i18next';

import {
	companionSurfaceBlockActionLabel,
	companionSurfaceBlockKindI18nKey,
	companionSurfaceBlockStatusLabel,
	dispatchCompanionSurfaceBlockAction,
	filterCompanionSurfaceBlockActions,
	primaryCompanionSurfaceBlock,
} from '@/features/ewa/companionOutputSurface/companionSurfaceBlockUi';
import { CompanionSurfaceBlockBody } from '@/features/ewa/companionOutputSurface/CompanionSurfaceBlockBody';
import { CompanionPillBadge } from '@/features/ewa/companionPremiumPrimitives';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionSurfaceBlockStripProps = {
	run: EwaCompanionTaskRun;
	ru: boolean;
	onConfirmRun: (runId: string, decision: 'confirm' | 'cancel') => void;
	onDraftPlayPrompt: (text: string) => void;
	onFocusRun?: (runId: string) => void;
};

export function CompanionSurfaceBlockStrip({
	run,
	ru,
	onConfirmRun,
	onDraftPlayPrompt,
	onFocusRun,
}: CompanionSurfaceBlockStripProps) {
	const { t } = useTranslation('marketing');
	const block = primaryCompanionSurfaceBlock(run);
	if (!block) return null;

	const statusLabel = companionSurfaceBlockStatusLabel(block, t);
	const actions = filterCompanionSurfaceBlockActions(block, run.status || '');

	return (
		<div
			className="flex flex-col gap-1"
			data-testid="ewa-companion-surface-block-strip"
			data-surface-block-kind={block.kind}
		>
			<div className="flex flex-wrap items-center gap-1.5">
				<CompanionPillBadge
					className={cn(
						'border-(--companion-aura)/40 bg-(--companion-aura)/10 px-1.5',
						'text-[10px] font-medium text-(--companion-aura)'
					)}
				>
					{t(companionSurfaceBlockKindI18nKey(block.kind))}
				</CompanionPillBadge>
				{statusLabel ? (
					<span className="text-[10px] text-(--companion-text-soft)">
						{statusLabel}
					</span>
				) : null}
			</div>
			{actions.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{actions.map((action) => {
						const label = companionSurfaceBlockActionLabel(action, ru);
						const decision =
							typeof action.payload?.decision === 'string'
								? action.payload.decision
								: '';
						return (
							<button
								key={`${action.type}:${decision}:${label}`}
								type="button"
								className={cn(
									'rounded-md border border-(--companion-divider) px-2 py-0.5',
									'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() =>
									dispatchCompanionSurfaceBlockAction(
										action,
										run,
										{ onConfirmRun, onDraftPlayPrompt },
										t
									)
								}
							>
								{label}
							</button>
						);
					})}
				</div>
			) : null}
			<CompanionSurfaceBlockBody
				block={block}
				ru={ru}
				onDraftPlayPrompt={onDraftPlayPrompt}
				onFocusRun={onFocusRun}
			/>
		</div>
	);
}
