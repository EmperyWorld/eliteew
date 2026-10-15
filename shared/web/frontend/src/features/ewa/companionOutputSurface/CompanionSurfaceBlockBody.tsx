/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Kind-specific payload body for server surface blocks (U4.10–U4.13 + payload hints).
 *
 * Invariants:
 * - View-only except explicit user clicks (choice prompt, builder surface, history focus).
 * - Missing optional handlers hide builder/history CTAs without error UI.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/companionSurfaceBlockPayload.ts
 */

import { useTranslation } from 'react-i18next';

import {
	companionSurfaceBlockBodyVisible,
	parseCompanionSurfaceBlockChoices,
	parseCompanionSurfaceBlockHistoryRef,
	parseCompanionSurfaceBlockResultHint,
	parseCompanionSurfaceBlockStepsSummary,
	parseCompanionSurfaceBlockText,
} from '@/features/ewa/companionOutputSurface/companionSurfaceBlockPayload';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionSurfaceBlock } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionSurfaceBlockBodyProps = {
	block: CompanionSurfaceBlock;
	ru: boolean;
	onDraftPlayPrompt: (text: string) => void;
	onFocusRun?: (runId: string) => void;
};

export function CompanionSurfaceBlockBody({
	block,
	ru,
	onDraftPlayPrompt,
	onFocusRun,
}: CompanionSurfaceBlockBodyProps) {
	const { t } = useTranslation('marketing');
	if (!companionSurfaceBlockBodyVisible(block, ru)) return null;

	if (block.kind === 'text') {
		const text = parseCompanionSurfaceBlockText(block, ru);
		if (!text) return null;
		return (
			<p
				className="text-[10px] leading-snug text-(--companion-text-soft)"
				data-testid="ewa-companion-surface-block-text"
			>
				{text}
			</p>
		);
	}

	if (block.kind === 'choice') {
		const choices = parseCompanionSurfaceBlockChoices(block, ru);
		if (choices.length === 0) return null;
		return (
			<div
				className="flex flex-wrap gap-1"
				data-testid="ewa-companion-surface-block-choices"
			>
				{choices.map((choice) => (
					<button
						key={choice.id}
						type="button"
						className={cn(
							'rounded-md border border-(--companion-divider) px-2 py-0.5',
							'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onDraftPlayPrompt(choice.prompt)}
					>
						{choice.label}
					</button>
				))}
			</div>
		);
	}

	if (block.kind === 'builder') {
		return null;
	}

	if (block.kind === 'history_ref') {
		const historyRef = parseCompanionSurfaceBlockHistoryRef(block, ru);
		if (!historyRef || !onFocusRun) return null;
		return (
			<button
				type="button"
				data-testid="ewa-companion-surface-block-history-ref"
				className={cn(
					'rounded-md border border-(--companion-divider) px-2 py-0.5',
					'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => onFocusRun(historyRef.runId)}
			>
				{t('ewaCompanion.surfaceBlockOpenHistoryRun', {
					label: historyRef.label,
				})}
			</button>
		);
	}

	if (block.kind === 'workflow_timeline') {
		const summary = parseCompanionSurfaceBlockStepsSummary(block);
		if (!summary) return null;
		return (
			<p
				className="text-[10px] text-(--companion-text-soft)"
				data-testid="ewa-companion-surface-block-steps-summary"
			>
				{t('ewaCompanion.surfaceBlockStepsSummary', {
					completed: summary.completed,
					total: summary.total,
				})}
			</p>
		);
	}

	if (block.kind === 'result') {
		const hint = parseCompanionSurfaceBlockResultHint(block, ru);
		if (!hint) return null;
		return (
			<p
				className="text-[10px] text-(--companion-text-soft)"
				data-testid="ewa-companion-surface-block-result-hint"
			>
				{hint}
			</p>
		);
	}

	return null;
}
